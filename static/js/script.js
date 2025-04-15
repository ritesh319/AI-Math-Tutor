document.addEventListener('DOMContentLoaded', () => {

    // DOM Elements
    const chatMessages = document.getElementById('chatMessages');
    const textInput = document.getElementById('textInput');
    const sendBtn = document.getElementById('sendBtn');
    const imageUploadInput = document.getElementById('imageUpload');
    const imageUploadBtn = document.getElementById('imageUploadBtn');
    const imageTypeSelect = document.getElementById('imageTypeSelect');
    const startRecordBtn = document.getElementById('startRecordBtn');
    const stopRecordBtn = document.getElementById('stopRecordBtn');

    // State Variables
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob = null;
    let recordingTimerInterval;
    let recordingSeconds = 0;
    let typingIndicator = null;

    // Add Message to Chat
    function addMessage(sender, content, options = {}) {
        const { isHtml = false, isError = false, isTyping = false, transcription = null, imageUrl = null } = options;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        if (isError) messageDiv.classList.add('error');
        if (isTyping) messageDiv.classList.add('typing');

        const avatar = document.createElement('div');
        avatar.classList.add('avatar');
        avatar.innerHTML = sender === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        const messageContentDiv = document.createElement('div');
        messageContentDiv.classList.add('message-content');

        const username = document.createElement('div');
        username.classList.add('username');
        username.textContent = sender === 'user' ? 'You' : 'Math Helper';

        const textDiv = document.createElement('div');
        textDiv.classList.add('text');

        if (isTyping) {
            textDiv.innerHTML = '<span></span><span></span><span></span>';
        } else if (isHtml) {
            textDiv.innerHTML = content;
        } else {
            textDiv.textContent = content;
        }

        if (transcription) {
            const transcriptionDiv = document.createElement('div');
            transcriptionDiv.classList.add('transcription');
            transcriptionDiv.innerHTML = `Extracted: "${transcription}"`;
            textDiv.appendChild(transcriptionDiv);
        }

        if (imageUrl) {
            const imgPreview = document.createElement('img');
            imgPreview.src = imageUrl;
            imgPreview.classList.add('preview');
            imgPreview.title = 'Click to view full image';
            imgPreview.alt = 'User uploaded image preview';
            imgPreview.onclick = () => window.open(imageUrl);
            textDiv.appendChild(imgPreview);
        }

        messageContentDiv.appendChild(username);
        messageContentDiv.appendChild(textDiv);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContentDiv);

        if (chatMessages) {
             chatMessages.appendChild(messageDiv);
             chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        return messageDiv;
    }

    function typesetMath(element = chatMessages) {
        if (window.MathJax && window.MathJax.typesetPromise && element) {
             // Small delay allows DOM updates
             setTimeout(() => {
                 MathJax.typesetPromise([element])
                      .catch((err) => console.error('MathJax typesetting error:', err));
             }, 50);
        }
    }

    // Typing Indicator
    function showTypingIndicator() {
        hideTypingIndicator();
        typingIndicator = addMessage('ai', '', { isTyping: true });
    }

    function hideTypingIndicator() {
         if (typingIndicator) {
             typingIndicator.style.transition = 'opacity 0.3s ease-out';
             typingIndicator.style.opacity = '0';
             setTimeout(() => {
                // Basic check before removing
                if (typingIndicator?.parentNode) {
                    typingIndicator.remove();
                }
                typingIndicator = null;
             }, 300);
         }
    }

    // Send Request Helper (UPDATED)
    async function sendRequest(url, options) {
        showTypingIndicator();
        try {
            const fetchUrl = url.startsWith('/') ? url : `/${url}`;
            const response = await fetch(fetchUrl, options);

            // Check for empty response
            if (response.status === 204) {
                hideTypingIndicator();
                addMessage('ai', 'Error: Server returned empty response', { isError: true });
                return;
            }

            // Check content type
            const contentType = response.headers.get('content-type');
            let result;
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                const text = await response.text();
                hideTypingIndicator();
                addMessage('ai', `Server error: Unexpected response format (${response.status})`, {
                    isError: true,
                    isHtml: true,
                    transcription: `Raw response: ${text.slice(0, 100)}...`
                });
                return;
            }

            hideTypingIndicator();

            if (!response.ok || result.error) {
                addMessage('ai', `Error: ${result.error || `Server responded with status ${response.status}`}`, { 
                    isError: true,
                    transcription: result.details ? `Details: ${result.details}` : null 
                });
            } else {
                let displayContent = result.solution || "Sorry, I couldn't process that.";
                let transcriptionText = result.original_extracted_text || null;
                if (transcriptionText && !result.solution) {
                    displayContent = "Extracted text, but couldn't generate a solution.";
                }
                const newAiMessage = addMessage('ai', displayContent, { transcription: transcriptionText });
                if (newAiMessage) typesetMath(newAiMessage);
            }
        } catch (error) {
            hideTypingIndicator();
            console.error(`Fetch Error (${url}):`, error);
            const errorMessage = error instanceof SyntaxError 
                ? 'Invalid server response format' 
                : error.message.includes('Failed to fetch')
                    ? 'Connection failed - check network'
                    : 'Unexpected error occurred';
            addMessage('ai', `Error: ${errorMessage}`, { 
                isError: true,
                transcription: error instanceof TypeError ? 'Network error occurred' : null
            });
        }
    }

    // Handle Text Input
    function handleTextInput() {
        const query = textInput.value.trim();
        if (!query) return;

        addMessage('user', query);
        textInput.value = '';
        textInput.style.height = 'auto';

        sendRequest('/solve_text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query })
        });
    }

    // Handle Image Input
    function handleImageInput(event) {
        const file = event.target.files[0];
        if (!file) return;

        const imageType = imageTypeSelect.value;
        const imageTypeText = imageTypeSelect.options[imageTypeSelect.selectedIndex].text;

        const reader = new FileReader();
        reader.onload = (e) => {
            addMessage('user', `Image (${imageTypeText}): ${file.name}`, { imageUrl: e.target.result });

            const formData = new FormData();
            formData.append('image', file);
            formData.append('input_type', imageType);

            sendRequest('/upload_image', { method: 'POST', body: formData });
        }
        reader.readAsDataURL(file);
        if (imageUploadInput) imageUploadInput.value = ''; 
    }

    // Handle Voice Input: Start
    async function startRecording() {
         try {
             const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : {};
             mediaRecorder = new MediaRecorder(stream, options);
             audioChunks = [];
             audioBlob = null;

             mediaRecorder.ondataavailable = event => {
                 if (event.data.size > 0) audioChunks.push(event.data);
             };

             mediaRecorder.onstop = () => {
                 if (audioChunks.length > 0) {
                     audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                     submitAudio();
                 } else {
                     addMessage('ai', 'Notice: Recording was too short.', { isError: true });
                 }
                 if (stopRecordBtn) {
                    stopRecordBtn.disabled = true;
                    stopRecordBtn.classList.remove('active');
                    stopRecordBtn.title = "Stop Recording";
                 }
                 if (startRecordBtn) startRecordBtn.disabled = false;
                 clearInterval(recordingTimerInterval);
                 stream.getTracks().forEach(track => track.stop()); 
             };

             mediaRecorder.start();

             if (startRecordBtn) startRecordBtn.disabled = true;
             if (stopRecordBtn) {
                 stopRecordBtn.disabled = false;
                 stopRecordBtn.classList.add('active');
             }

             recordingSeconds = 0;
             updateRecordingTitle();
             recordingTimerInterval = setInterval(updateRecordingTitle, 1000);

         } catch (error) {
             console.error("Microphone access error:", error);

             let errorMsg = "Could not access microphone.";
             if (error.name === 'NotAllowedError') errorMsg = "Microphone permission denied.";
             else if (error.name === 'NotFoundError') errorMsg = "No microphone found.";
             addMessage('ai', `Error: ${errorMsg}`, { isError: true });

             if (startRecordBtn) startRecordBtn.disabled = false;
             if (stopRecordBtn) {
                stopRecordBtn.disabled = true;
                stopRecordBtn.classList.remove('active');
             }
         }
    }

    // Handle Voice Input: Update Timer
    function updateRecordingTitle() {
         recordingSeconds++;
         const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
         const secs = String(recordingSeconds % 60).padStart(2, '0');
         // Update stop button title if it exists
         if (stopRecordBtn) stopRecordBtn.title = `Stop Recording (${mins}:${secs})`;
    }

    // Handle Voice Input: Stop
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
             mediaRecorder.stop();
        }
    }

    // Handle Voice Input: Submit
    function submitAudio() {
        if (!audioBlob || audioBlob.size === 0) {
             return;
        }
        addMessage('user', '🎤 Recorded Audio Sent');
        const formData = new FormData();
        const filename = `audio.${audioBlob.type.split('/')[1] || 'webm'}`;
        formData.append("audio", audioBlob, filename);
        sendRequest("/upload_audio", { method: "POST", body: formData });

        // Reset state
        audioChunks = [];
        audioBlob = null;
        recordingSeconds = 0;
    }

    function adjustTextareaHeight() {
        if (!textInput) return;
        textInput.style.height = 'auto';
        const maxHeight = 100; // Defined max height
        const newHeight = Math.min(textInput.scrollHeight, maxHeight);
        textInput.style.height = newHeight + 'px';
    }


    if (sendBtn) sendBtn.addEventListener('click', handleTextInput);
    if (textInput) {
        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTextInput();
            }
        });
        textInput.addEventListener('input', adjustTextareaHeight);
    }
    if (imageUploadBtn) imageUploadBtn.addEventListener('click', () => imageUploadInput?.click()); // Use optional chaining
    if (imageUploadInput) imageUploadInput.addEventListener('change', handleImageInput);
    if (startRecordBtn) startRecordBtn.addEventListener('click', startRecording);
    if (stopRecordBtn) stopRecordBtn.addEventListener('click', stopRecording);

    // Initialization
    function initializeApp() {
        adjustTextareaHeight();

        if (window.MathJax?.startup?.ready) {
            window.MathJax.startup.ready().then(() => {
                 console.log("MathJax ready.");
                 typesetMath();
            }).catch(err => console.error("MathJax startup failed:", err));
        }
    }

    initializeApp();

});
