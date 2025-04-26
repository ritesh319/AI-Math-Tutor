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
    const fullscreenOverlay = document.getElementById('fullscreen-overlay');
    const fullscreenGraphContainer = document.getElementById('fullscreen-graph-container');
    const closeFullscreenBtn = document.getElementById('close-fullscreen-btn');

    // State Variables
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob = null;
    let recordingTimerInterval;
    let recordingSeconds = 0;
    let typingIndicator = null;
    let referencedMessageId = null;
    const defaultPlaceholder = "Type your math problem...";


    function renderPlot(targetDivId, plotData) {
        try {
            const compiledFunc = math.compile(plotData.func);
            const xValues = [];
            const yValues = [];

             if (!Number.isInteger(plotData.steps) || plotData.steps <= 1 ) {
                console.warn("Invalid step count for plot, defaulting to 100:", plotData.steps);
                plotData.steps = 100;
            }
             if (plotData.x_max <= plotData.x_min) {
                 console.warn("Invalid x range for plot (max <= min), adjusting slightly.");
                 plotData.x_max = plotData.x_min + 1;
             }

            const stepSize = (plotData.x_max - plotData.x_min) / (plotData.steps - 1);

            for (let i = 0; i < plotData.steps; i++) {
                const x = plotData.x_min + i * stepSize;
                xValues.push(x);

                try {
                    const yResult = compiledFunc.evaluate({ x: x });

                     if (typeof yResult === 'number' && isFinite(yResult)) {
                        yValues.push(yResult);
                     } else {
                        console.warn(`Function evaluated to non-finite value at x=${x}, skipping point.`);
                        yValues.push(null);
                     }
                } catch (evalError) {
                     console.error(`Error evaluating function '${plotData.func}' at x=${x}:`, evalError);
                     yValues.push(null);
                }
            }

            const trace = {
                x: xValues,
                y: yValues,
                mode: 'lines',
                type: 'scatter',
                connectgaps: false,
                line: {
                    color: 'rgba(88, 166, 255, 0.9)',
                    width: 2.5,
                    shape: 'spline'
                },
                hoverinfo: 'x+y'
            };

            const layout = {
                template: 'plotly_dark',
                paper_bgcolor: 'rgba(0, 0, 0, 0)',
                plot_bgcolor: 'rgba(0, 0, 0, 0)',
                font: {
                    family: getComputedStyle(document.documentElement).getPropertyValue('--font-family').trim() || 'Poppins, sans-serif',
                    size: 13,
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#b0b3b8'
                },
                xaxis: {
                    gridcolor: 'rgba(255, 255, 255, 0.1)',
                    linecolor: 'rgba(255, 255, 255, 0.2)',
                    zerolinecolor: 'rgba(255, 255, 255, 0.2)',
                    titlefont: {
                       color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e4e6eb'
                    },
                     tickfont: {
                       color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#b0b3b8'
                    },
                    showline: true,
                    zeroline: true
                },
                yaxis: {
                    gridcolor: 'rgba(255, 255, 255, 0.1)',
                    linecolor: 'rgba(255, 255, 255, 0.2)',
                    zerolinecolor: 'rgba(255, 255, 255, 0.2)',
                     titlefont: {
                       color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e4e6eb'
                    },
                     tickfont: {
                       color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#b0b3b8'
                    },
                    showline: true,
                    zeroline: true
                },
                margin: { l: 50, r: 50, t: 40, b: 40 },
                hoverlabel: {
                    bgcolor: 'rgba(30, 32, 37, 0.8)',
                    font: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e4e6eb',
                        size: 12
                    },
                    bordercolor: 'rgba(255, 255, 255, 0.2)'
                }
            };

            const config = {
                displayModeBar: true,
                responsive: true
            };

            const targetDiv = document.getElementById(targetDivId);
            if(targetDiv){ 
                 Plotly.newPlot(targetDivId, [trace], layout, config);
                 console.log(`Inline Plotly graph rendered in #${targetDivId}`);
                 setTimeout(() => {
                     if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
                 }, 200);
            } else {
                 console.error(`Target div #${targetDivId} not found for inline plot.`);
            }

        } catch (error) {
            console.error("Error rendering inline Plotly graph:", error);
            const targetDiv = document.getElementById(targetDivId);
            if (targetDiv) {
                targetDiv.textContent = `Error rendering plot: ${error.message}`;
                targetDiv.style.color = '#f04747';
            }
        }
    }

    function renderFullscreenPlot(plotData) {
         try {
            const compiledFunc = math.compile(plotData.func);
            const xValues = []; const yValues = [];
            if (!Number.isInteger(plotData.steps) || plotData.steps <= 1 ) { plotData.steps = 100; }
            if (plotData.x_max <= plotData.x_min) { plotData.x_max = plotData.x_min + 1; }
            const stepSize = (plotData.x_max - plotData.x_min) / (plotData.steps - 1);
            for (let i = 0; i < plotData.steps; i++) {
                const x = plotData.x_min + i * stepSize; xValues.push(x);
                try 
                { 
                    const yResult = compiledFunc.evaluate({ x: x }); 
                    yValues.push((typeof yResult === 'number' && isFinite(yResult)) ? yResult : null); 
                } 
                catch (evalError) 
                { console.error(`FS Eval error at x=${x}:`, evalError); yValues.push(null); }
            }

            const trace = {
                x: xValues, 
                y: yValues, 
                mode: 'lines', 
                type: 'scatter', 
                connectgaps: false, 
                line: { color: 'rgba(88, 166, 255, 0.9)', width: 2.5, shape: 'spline' }, 
                hoverinfo: 'x+y' };

            const layout = {
                template: 'plotly_dark', 
                paper_bgcolor: 'rgba(0, 0, 0, 0)', 
                plot_bgcolor: 'rgba(0, 0, 0, 0)', 
                font: { 
                family: getComputedStyle(document.documentElement).getPropertyValue('--font-family').trim() || 'Poppins, sans-serif', 
                size: 13, 
                color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#b0b3b8' }, 
                xaxis: { 
                    gridcolor: 'rgba(255, 255, 255, 0.1)', 
                    linecolor: 'rgba(255, 255, 255, 0.2)', 
                    zerolinecolor: 'rgba(255, 255, 255, 0.2)', 
                    titlefont: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e4e6eb' }, 
                    tickfont: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#b0b3b8' }, 
                    showline: true, 
                    zeroline: true }, 
                yaxis: { 
                    gridcolor: 'rgba(255, 255, 255, 0.1)', 
                    linecolor: 'rgba(255, 255, 255, 0.2)', 
                    zerolinecolor: 'rgba(255, 255, 255, 0.2)', 
                    titlefont: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e4e6eb' }, 
                    tickfont: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#b0b3b8' }, 
                    showline: true, zeroline: true }, 

                margin: { l: 50, r: 30, t: 40, b: 40 }, 
                hoverlabel: {   
                                bgcolor: 'rgba(30, 32, 37, 0.8)', 
                                font: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#e4e6eb', size: 12 }, 
                                bordercolor: 'rgba(255, 255, 255, 0.2)' 
                            } 
                            };

            const config = { displayModeBar: true, responsive: true };

            if (fullscreenGraphContainer) {
                Plotly.purge(fullscreenGraphContainer);
                fullscreenGraphContainer.innerHTML = ''; 
                Plotly.newPlot(fullscreenGraphContainer, [trace], layout, config);
                console.log(`Fullscreen Plotly graph rendered`);
            } else {
                console.error("Fullscreen graph container not found in DOM.");
            }

        } catch (error) {
            console.error("Error rendering fullscreen Plotly graph:", error);
             if (fullscreenGraphContainer) {
                fullscreenGraphContainer.innerHTML = `<div style="color: #f04747; padding: 20px;">Error rendering fullscreen plot: ${error.message}</div>`;
             }
        }
    }


    function addMessage(sender, content, options = {}) {
        const { isHtml = false, isError = false, isTyping = false, transcription = null, imageUrl = null } = options;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        if (isError) messageDiv.classList.add('error'); if (isTyping) messageDiv.classList.add('typing');
        const messageId = `msg-${Date.now()}-${Math.random().toString(16).substring(2, 8)}`;
        messageDiv.dataset.messageId = messageId; messageDiv.id = messageId;

        const avatar = document.createElement('div'); avatar.classList.add('avatar'); avatar.innerHTML = sender === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        const messageContentDiv = document.createElement('div'); messageContentDiv.classList.add('message-content');
        const username = document.createElement('div'); username.classList.add('username'); username.textContent = sender === 'user' ? 'You' : 'Math Helper';
        const textDiv = document.createElement('div'); textDiv.classList.add('text');

        let plotData = null; let processedContent = content; let hasPlot = false;

        if (sender === 'ai' && !isTyping && !isError && typeof content === 'string') {
            textDiv.dataset.rawContent = content;

            const plotRegex = /\[PLOT\s+func=['"]([^'"]+)['"]\s+x_min\s*=\s*([^=\s][^=\s]*(?=\s+x_max))\s+x_max\s*=\s*([^=\s][^=\s]*(?=\s+steps))\s+steps\s*=\s*(\d+)\s*\]/i;
            const match = content.match(plotRegex);
            if (match) {
                console.log("Plot tag found:", match[0]);
                try {
                    plotData = { func: match[1], x_min: math.evaluate(match[2]), x_max: math.evaluate(match[3]), steps: parseInt(match[4], 10) };
                    if (typeof plotData.x_min !== 'number' || typeof plotData.x_max !== 'number' || isNaN(plotData.x_min) || isNaN(plotData.x_max) || isNaN(plotData.steps)) {
                         throw new Error("Invalid number format or evaluation failed in plot tag parameters.");
                     }
                    processedContent = content.replace(plotRegex, '').trim();
                    console.log("Parsed plot data:", plotData);
                    hasPlot = true;
                } catch (parseError) {
                    console.error("Error parsing plot tag or evaluating range:", parseError, "Original tag:", match[0]);
                    plotData = null; processedContent = content; hasPlot = false;
                }
            }
        }

        if (isTyping) textDiv.innerHTML = '<span></span><span></span><span></span>';
        else if (isHtml) textDiv.innerHTML = processedContent;
        else textDiv.textContent = processedContent;

        if (transcription) { 
            const transcriptionDiv = document.createElement('div'); 
            transcriptionDiv.classList.add('transcription'); 
            transcriptionDiv.innerHTML = `Extracted: "${transcription}"`; 
            textDiv.appendChild(transcriptionDiv); 
        }
        if (imageUrl && sender === 'user') {
            const imgPreview = document.createElement('img'); imgPreview.src = imageUrl; 
            imgPreview.classList.add('preview'); 
            imgPreview.title = 'Click to view full image'; 
            imgPreview.alt = 'User uploaded image preview'; 
            imgPreview.onclick = () => window.open(imageUrl); 
            textDiv.appendChild(imgPreview); 
        }

        messageContentDiv.appendChild(username); messageContentDiv.appendChild(textDiv);

        let plotContainerId = null;
        if (plotData) {
            const plotContainer = document.createElement('div'); plotContainerId = `plot-${messageId}`; plotContainer.id = plotContainerId; plotContainer.classList.add('plot-container');
            messageContentDiv.appendChild(plotContainer);
        }

        // Add Action Buttons Container
        if (sender === 'ai' && !isTyping && !isError) {
             const actionsDiv = document.createElement('div'); 
             actionsDiv.classList.add('message-actions');
             const copyBtn = document.createElement('button'); 
             copyBtn.classList.add('action-btn', 'copy-btn'); 
             copyBtn.title = 'Copy response text'; 
             copyBtn.innerHTML = '<i class="far fa-copy"></i>'; 
             copyBtn.addEventListener('click', handleCopyClick); 
             actionsDiv.appendChild(copyBtn);
             const retryBtn = document.createElement('button'); 
             retryBtn.classList.add('action-btn', 'retry-btn'); 
             retryBtn.title = 'Correct this response'; 
             retryBtn.innerHTML = '<i class="fas fa-redo-alt"></i>'; 
             retryBtn.addEventListener('click', handleRetryCorrectClick); 
             actionsDiv.appendChild(retryBtn);

             if (hasPlot) {
                 const fullscreenBtn = document.createElement('button');
                 fullscreenBtn.classList.add('action-btn', 'fullscreen-btn');
                 fullscreenBtn.title = 'View graph fullscreen';
                 fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
                 fullscreenBtn.dataset.messageId = messageId;
                 fullscreenBtn.addEventListener('click', handleFullscreenClick);
                 actionsDiv.appendChild(fullscreenBtn);
             }

             messageContentDiv.appendChild(actionsDiv);
        }

        messageDiv.appendChild(avatar); messageDiv.appendChild(messageContentDiv);

        if (chatMessages) {
             chatMessages.appendChild(messageDiv);
             setTimeout(() => { if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight; }, 100);
             if (plotContainerId && plotData) { setTimeout(() => renderPlot(plotContainerId, plotData), 50); }
        }
        return messageDiv;
    }

    function handleFullscreenClick(event) {
        const button = event.currentTarget;
        const messageId = button.dataset.messageId;
        console.log(`[FS Click] Handling click for messageId: ${messageId}`);

            const originalMessage = document.getElementById(messageId);
            if (!originalMessage) {
                console.error("[FS Plot Error] Original message element not found:", messageId);
                showOverlay(); 
                return; 
            }
            console.log("[FS Click] Found original message element.");

            const textDiv = originalMessage.querySelector('.message-content .text');
            if (!textDiv) { 
                console.error("[FS Plot Error] Text div not found:", messageId); 
                showOverlay(); 
                return; 
            }
            console.log("[FS Click] Found text div.");

            const rawContent = textDiv.dataset.rawContent;

            if (rawContent === undefined || rawContent === null) {
                console.error("[FS Plot Error] Raw content (data-raw-content) is undefined or null for message:", messageId, "Dataset:", textDiv.dataset);
                if (fullscreenGraphContainer) fullscreenGraphContainer.innerHTML = `<div style="color: #f04747; padding: 20px;">Error: Cannot find original plot data.</div>`;
                showOverlay();
                return;
            }

             console.log(`[FS Click] Found rawContent. Type: ${typeof rawContent}, Length: ${rawContent.length}`);
             console.log("[FS Click] === START RAW CONTENT ===");
             console.log(rawContent);
             console.log("[FS Click] === END RAW CONTENT ===");


            const plotRegex = /\[PLOT\s+func=['"]([^'"]+)['"]\s+x_min\s*=\s*([\-\d\.\+eE*pi]+)\s+x_max\s*=\s*([\-\d\.\+eE*pi]+)\s+steps\s*=\s*(\d+)\s*\]/i; // Slightly adjusted regex again just in case
            const match = rawContent.match(plotRegex);
            let plotData = null;

            if (match) {
                 console.log("[FS Click] Regex matched:", match[0]);
                try {
                    plotData = { func: match[1], x_min: math.evaluate(match[2]), x_max: math.evaluate(match[3]), steps: parseInt(match[4], 10) }; 
                    if (typeof plotData.x_min !== 'number' || typeof plotData.x_max !== 'number' || isNaN(plotData.x_min) || isNaN(plotData.x_max) || isNaN(plotData.steps)) { 
                        throw new Error("Invalid number format in plot tag parameters."); 
                    } console.log("[FS Click] Successfully parsed plotData:", plotData); 
                } 
                catch (parseError) {
                    console.error("[FS Plot Error] Error re-parsing tag/evaluating range:", parseError); 
                    if (fullscreenGraphContainer) fullscreenGraphContainer.innerHTML = `<div style="color: #f04747; padding: 20px;">Error reading plot data. (${parseError.message})</div>`; 
                    showOverlay(); 
                    return; 
                }
            } 
            else {
                 console.error("[FS Plot Error] Regex did *not* match plot tag in the logged rawContent above for message:", messageId);
                 if (fullscreenGraphContainer) fullscreenGraphContainer.innerHTML = `<div style="color: #f04747; padding: 20px;">Error: Plot data tag not found in message content.</div>`;
                 showOverlay(); 
                 return;
            }

            console.log("[FS Click] Proceeding to render fullscreen plot.");
            renderFullscreenPlot(plotData);
            showOverlay();
    }

    function showOverlay() {
        if (fullscreenOverlay) {
            fullscreenOverlay.classList.add('visible');
            document.body.classList.add('noscroll');
        }
    }

    function hideOverlay() {
         if (fullscreenOverlay) {
            fullscreenOverlay.classList.remove('visible');
            document.body.classList.remove('noscroll');
             if (fullscreenGraphContainer) {
                 Plotly.purge(fullscreenGraphContainer);
                 fullscreenGraphContainer.innerHTML = '';
             }
        }
    }


    function handleCopyClick(event) {
        const button = event.currentTarget;

        const messageContentDiv = button.closest('.message-content');
        if (!messageContentDiv) return;

        const textDiv = messageContentDiv.querySelector('.text');
        if (!textDiv) return;

        const textClone = textDiv.cloneNode(true);
        const transcriptionNode = textClone.querySelector('.transcription');
        if (transcriptionNode) transcriptionNode.remove();

        const plotContainer = textClone.querySelector('.plot-container');
        if (plotContainer) plotContainer.remove();

        const textToCopy = textClone.innerText || textClone.textContent;

        if (textToCopy && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(textToCopy.trim()).then(() => 
            {button.innerHTML = '<i class="fas fa-check"></i>'; button.title = 'Copied!'; button.classList.add('copied'); setTimeout(() =>
            {button.innerHTML = '<i class="far fa-copy"></i>'; button.title = 'Copy response text'; button.classList.remove('copied'); }, 1500); 
            }).catch(err => {console.error('Failed to copy text:', err); console.log('HTTPS Context:', window.location.protocol === 'https:' ? 'Yes' : 'No'); 
                button.title = 'Copy failed'; setTimeout(() => { button.title = 'Copy response text'; }, 2500); });
        } 
        else { console.error("Clipboard API unavailable/text empty."); button.title = 'Copy failed'; }
    }

    function handleRetryCorrectClick(event) { 
        const button = event.currentTarget; 
        const messageDiv = button.closest('.message'); 
        if (!messageDiv) return; 
        const messageIdToRetry = messageDiv.dataset.messageId; 
        clearReferenceHighlighting(); 
        messageDiv.classList.add('referenced'); 
        referencedMessageId = messageIdToRetry; 
        if (textInput) { 
            textInput.placeholder = `Correction for highlighted message...`; 
            textInput.focus(); 
        } 
        console.log("Referencing message ID:", referencedMessageId); 
    }

    function clearReferenceHighlighting() { 
        if (referencedMessageId) { 
            const previousReferenced = document.getElementById(referencedMessageId); 
            if (previousReferenced) previousReferenced.classList.remove('referenced'); 
        } 
        referencedMessageId = null; 
        if (textInput) textInput.placeholder = defaultPlaceholder; 
        console.log("Cleared message reference."); 
    }

    async function sendRequest(url, options, isCorrection = false) { 
        showTypingIndicator(); 
        let newAiMessage = null; 
        try { 
            const fetchUrl = url.startsWith('/') ? url : `/${url}`; 
            const response = await fetch(fetchUrl, options); 
            const result = await response.json(); 
            hideTypingIndicator(); 
            if (!response.ok || result.error) { 
                addMessage('ai', `Error: ${result.error || `Server status ${response.status}`}`, { isError: true }); 
            } 
            else { 
                let displayContent = result.solution || "Processing failed."; 
                let transcriptionText = result.original_extracted_text || null; 
                if (transcriptionText && !result.solution && result.original_input_type !== 'text') displayContent = "Extracted text, but no solution."; 
                newAiMessage = addMessage('ai', displayContent, { transcription: transcriptionText, isHtml: true }); 
            } 
        } 
        catch (error) { 
            hideTypingIndicator(); 
            console.error(`Fetch Error (${url}):`, error); 
            addMessage('ai', 'Error: Could not connect to server.', { isError: true }); 
        } 
        finally { 
            hideTypingIndicator(); 
            if (newAiMessage && !newAiMessage.classList.contains('error')) { 
                setTimeout(() => typesetMath(newAiMessage), 100); 
            } 
            if (isCorrection) clearReferenceHighlighting(); 
        } 
    }


    function handleTextInput() { 
        const query = textInput.value.trim(); 
        if (!query) return; 
        addMessage('user', query); 
        const requestBody = { query: query }; 
        let isCorrection = false; 
        let proceedWithRequest = true; 
        if (referencedMessageId) {
             const referencedMessageElement = document.getElementById(referencedMessageId); 
             if (referencedMessageElement) { 
                const textDiv = referencedMessageElement.querySelector('.message-content .text'); 
                const referencedText = textDiv?.dataset?.rawContent; 
                if (referencedText !== undefined && referencedText !== null) { 
                    requestBody.referenced_message_content = referencedText.trim(); 
                    isCorrection = true; 
                    console.log(`Sending correction. Ref ID: ${referencedMessageId}. Query: ${query}.`); 
                } 
                else { 
                    console.error("Raw content missing for ref msg:", referencedMessageId); 
                    addMessage('ai', "Error: Failed to get original content for correction.", { isError: true }); 
                    proceedWithRequest = false; clearReferenceHighlighting(); 
                } 
            } 
            else { 
                console.error("Ref element not found:", referencedMessageId); 
                proceedWithRequest = false; 
                clearReferenceHighlighting(); 
            } 
        } 
        else { 
            console.log(`Sending new query: ${query}`); 
        } 
        textInput.value = ''; 
        adjustTextareaHeight(); 
        if (proceedWithRequest) { 
            sendRequest('/solve_text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }, isCorrection); 
        } 
        
    }

    function typesetMath(element = chatMessages) { 
        if (window.MathJax?.typesetPromise && element && document.body.contains(element)) { 
            setTimeout(() => { 
                if(document.body.contains(element)) { 
                    console.log("Typesetting MathJax for element:", element.id || element.tagName); 
                    window.MathJax.typesetPromise([element]).catch((err) => console.error('MathJax typesetting error on element:', element.id || element.tagName, err)); 
                } 
                else { 
                    console.log("Skipping MathJax: element removed:", element.id || element.tagName); 
                } 
            }, 
            200); 
        } 
        else 
        { 
            if (!window.MathJax?.typesetPromise) console.warn("MathJax typesetPromise not available."); 
        } 
    }

    function showTypingIndicator() { 
        hideTypingIndicator(); 
        typingIndicator = addMessage('ai', '', { isTyping: true }); 
        if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight; 
    }
    function hideTypingIndicator() { 
        if (typingIndicator) { 
            typingIndicator.style.transition = 'opacity 0.3s ease-out, height 0.3s ease-out, margin 0.3s ease-out, padding 0.3s ease-out'; 
            typingIndicator.style.opacity = '0'; 
            typingIndicator.style.height = '0'; 
            typingIndicator.style.marginBottom = '0'; 
            typingIndicator.style.marginTop = '0';
            typingIndicator.style.paddingTop = '0'; 
            typingIndicator.style.paddingBottom = '0'; 
            const innerText = typingIndicator.querySelector('.text'); 
            if(innerText) { 
                innerText.style.padding = '0'; 
                innerText.style.margin = '0'; 
                innerText.style.minHeight = '0'; 
            } 
            setTimeout(() => { 
                if (typingIndicator?.parentNode) typingIndicator.remove(); 
                typingIndicator = null; 
            }, 
            300); 
        } 
    }


    function handleImageInput(event) { 
        const file = event.target.files[0]; 
        if (!file) return; 
        const imageType = imageTypeSelect.value; 
        const imageTypeText = imageTypeSelect.options[imageTypeSelect.selectedIndex].text; 
        const reader = new FileReader(); 
        reader.onload = (e) => { 
            addMessage('user', `Image (${imageTypeText}): ${file.name}`, { imageUrl: e.target.result }); 
            const formData = new FormData(); formData.append('image', file); 
            formData.append('input_type', imageType); 
            sendRequest('/upload_image', { method: 'POST', body: formData }); 
        }; 
        reader.readAsDataURL(file); 
        if (imageUploadInput) imageUploadInput.value = ''; 
    }

    async function startRecording() { 
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { 
            addMessage('ai', 'Error: Audio recording not supported.', { isError: true }); 
            if(startRecordBtn) startRecordBtn.disabled = true; 
            if(stopRecordBtn) stopRecordBtn.disabled = true; return; } 
            try { 
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); 
                const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? { mimeType: 'audio/ogg;codecs=opus' } : {}; 
                mediaRecorder = new MediaRecorder(stream, options); audioChunks = []; 
                audioBlob = null; mediaRecorder.ondataavailable = event => { if (event.data.size > 0) audioChunks.push(event.data); }; 
                mediaRecorder.onstop = () => { 
                    clearInterval(recordingTimerInterval); 
                    stream.getTracks().forEach(track => track.stop()); 
                    if (audioChunks.length > 0) { 
                        const mimeType = mediaRecorder.mimeType || 'audio/webm'; 
                        audioBlob = new Blob(audioChunks, { type: mimeType }); 
                        if (audioBlob.size > 100) submitAudio(); 
                        else { 
                            console.warn("Blob size too small:", audioBlob.size); 
                            addMessage('ai', 'Notice: Recording too short.', { isError: true }); 
                        } 
                    } 
                    else { 
                        console.warn("No audio chunks."); 
                        addMessage('ai', 'Notice: No audio recorded.', { isError: true }); 
                    } 
                    if (stopRecordBtn) {
                        stopRecordBtn.disabled = true; 
                        stopRecordBtn.classList.remove('active'); 
                        stopRecordBtn.title = "Stop Recording"; 
                    }
                    if (startRecordBtn) startRecordBtn.disabled = false; recordingSeconds = 0; 
                }; 
                mediaRecorder.onerror = (event) => { 
                    console.error("MediaRecorder error:", event.error); 
                    addMessage('ai', `Recording error: ${event.error.name}`, { isError: true }); 
                    if (mediaRecorder?.state !== 'inactive') mediaRecorder.stop(); 
                    clearInterval(recordingTimerInterval); 
                    if (stopRecordBtn) { 
                        stopRecordBtn.disabled = true; 
                        stopRecordBtn.classList.remove('active'); 
                        stopRecordBtn.title = "Stop Recording"; 
                    } 
                    if (startRecordBtn) startRecordBtn.disabled = false; 
                    stream.getTracks().forEach(track => track.stop()); 
                }; 
                mediaRecorder.start(); 
                console.log("Recorder started:", mediaRecorder.state); 
                if (startRecordBtn) startRecordBtn.disabled = true; 
                if (stopRecordBtn) { 
                    stopRecordBtn.disabled = false; 
                    stopRecordBtn.classList.add('active'); 
                } 
                recordingSeconds = 0; 
                updateRecordingTitle(); 
                recordingTimerInterval = setInterval(updateRecordingTitle, 1000); 
            } 
            catch (error) { 
                console.error("Mic access error:", error); 
                let errorMsg = "Could not access mic."; 
                if (error.name === 'NotAllowedError'||error.name === 'PermissionDeniedError') errorMsg = "Mic permission denied."; 
                else if (error.name === 'NotFoundError'||error.name === 'DevicesNotFoundError') errorMsg = "No mic found."; 
                else if (error.name === 'NotReadableError'||error.name === 'TrackStartError') errorMsg = "Mic in use/unreadable."; 
                else if (error.name === 'SecurityError') errorMsg = "Mic access denied (security)."; 
                else if (error.name === 'AbortError') errorMsg = "Mic request aborted."; 
                else errorMsg = `Mic error: ${error.name}`; 
                addMessage('ai', `Error: ${errorMsg}`, { isError: true }); 
                if (startRecordBtn) startRecordBtn.disabled = false; 
                if (stopRecordBtn) { 
                    stopRecordBtn.disabled = true; 
                    stopRecordBtn.classList.remove('active'); 
                    stopRecordBtn.title = "Stop Recording"; 
                } 
                    clearInterval(recordingTimerInterval); 
            } 
        }

    function updateRecordingTitle() { 
        recordingSeconds++; 
        const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0'); 
        const secs = String(recordingSeconds % 60).padStart(2, '0'); 
        if (stopRecordBtn) stopRecordBtn.title = `Stop Recording (${mins}:${secs})`; 
    }

    function stopRecording() { 
        if (mediaRecorder?.state === 'recording') { console.log("Stopping Recorder..."); 
            mediaRecorder.stop(); 
        } 
        else { 
            console.warn("Stop called, not recording:", mediaRecorder?.state); 
            if (stopRecordBtn) { 
                stopRecordBtn.disabled = true; 
                stopRecordBtn.classList.remove('active'); 
                stopRecordBtn.title = "Stop Recording"; 
            } 
            if (startRecordBtn) startRecordBtn.disabled = false; 
            clearInterval(recordingTimerInterval); 
        } 
    }

    function submitAudio() { 
        if (!audioBlob || audioBlob.size <= 100) { 
            console.error("Submit audio: invalid blob", audioBlob); 
            return; 
        } 
        addMessage('user', '🎤 Recorded Audio Sent'); 
        const formData = new FormData(); 
        let fileExtension = 'webm'; 
        if (audioBlob.type) { 
            const typeParts=audioBlob.type.split('/'); 
            if(typeParts.length>1 && typeParts[0]==='audio'){
                const subtype=typeParts[1].split(';')[0]; 
                if(['webm','ogg','wav','mp4','aac'].includes(subtype)) fileExtension=subtype;
            }
        } 
        const filename=`audio_recording.${fileExtension}`; 
        formData.append("audio",audioBlob,filename); 
        sendRequest("/upload_audio",{method:"POST",body:formData}); 
        audioChunks=[]; 
        audioBlob=null;
    }


    function adjustTextareaHeight() { 
        if (!textInput) return; 
        textInput.style.height = 'auto'; 
        const maxHeight=100; 
        const scrollHeight=textInput.scrollHeight; 
        const newHeight=Math.min(scrollHeight,maxHeight); 
        textInput.style.height=newHeight+'px';
    }



    if (sendBtn) sendBtn.addEventListener('click', handleTextInput);
    if (textInput) {
        textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextInput(); } });
        textInput.addEventListener('input', adjustTextareaHeight);
        textInput.addEventListener('blur', () => { if (referencedMessageId && textInput.value.trim() === '') clearReferenceHighlighting(); });
    }
    if (imageUploadBtn) imageUploadBtn.addEventListener('click', () => imageUploadInput?.click());
    if (imageUploadInput) imageUploadInput.addEventListener('change', handleImageInput);
    if (startRecordBtn) startRecordBtn.addEventListener('click', startRecording);
    if (stopRecordBtn) stopRecordBtn.addEventListener('click', stopRecording);

    if (closeFullscreenBtn) {
        closeFullscreenBtn.addEventListener('click', hideOverlay);
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && fullscreenOverlay && fullscreenOverlay.classList.contains('visible')) {
            hideOverlay();
        }
    });

    if (fullscreenOverlay) {
         fullscreenOverlay.addEventListener('click', (event) => {

            if (event.target === fullscreenOverlay) {
                 hideOverlay();
             }
         });
    }

    function initializeApp() {
        adjustTextareaHeight();
        if (textInput) textInput.placeholder = defaultPlaceholder;
        if (window.MathJax?.startup?.promise) {
             window.MathJax.startup.promise.then(() => { console.log("MathJax ready."); if (chatMessages) typesetMath(chatMessages); }).catch(err => console.error("MathJax startup failed:", err));
        } else { console.warn("MathJax startup promise not found."); setTimeout(() => { if (window.MathJax?.typesetPromise && chatMessages) typesetMath(chatMessages); }, 1000); }
        if(stopRecordBtn) stopRecordBtn.disabled = true;
    }

    initializeApp();

});