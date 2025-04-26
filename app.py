from flask import Flask, render_template, request, jsonify
import os
import logging

from pt import answert
from voice import answer
from groq_solver import solve_with_groq

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
FEEDBACK_LOG_FILE = 'feedback.log'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/solve_text', methods=['POST'])
def solve_text():
    if not request.is_json:
        logging.warning("Received non-JSON request in /solve_text")
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    text_query = data.get('query')
    referenced_content = data.get('referenced_message_content')

    if not text_query:
        logging.warning("Received empty query in /solve_text")
        return jsonify({"error": "No query provided"}), 400

    if referenced_content:
         logging.info(f"Received correction request. User query: {text_query[:100]}... Referring to content: {referenced_content[:100]}...")
    else:
        logging.info(f"Received new text query: {text_query[:100]}...")

    try:
        result = solve_with_groq(text_query, referenced_message_content=referenced_content)

        if result.get("error"):
            logging.error(f"Groq solver returned error: {result['error']}")
        return jsonify(result)
    except Exception as e:
        logging.error(f"Error in /solve_text: {e}", exc_info=True)
        return jsonify({"error": "Server error processing text query."}), 500


@app.route('/upload_image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        logging.warning("Missing 'image' file part in /upload_image request")
        return jsonify({"error": "No image file part in the request"}), 400
    
    file = request.files['image']

    if not file or file.filename == '':
        logging.warning("No image file selected or invalid filename in /upload_image")
        return jsonify({"error": "No image file selected or invalid file"}), 400
    
    input_type = request.form.get('input_type', 'expression').strip().lower()
    logging.info(f"Received image upload. Type: {input_type}, Filename: {file.filename}")

    if input_type not in ['expression', 'word_problem']:
         logging.warning(f"Invalid input_type received: {input_type}")
         return jsonify({"error": f"Invalid input_type: '{input_type}'. Use 'expression' or 'word_problem'."}), 400
    
    try:
        image_filename = 'image.png'
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], image_filename)
        file.save(image_path)
        logging.info(f"Saved image to {image_path}")
        result = answert(input_type=input_type)

        if result.get("error"):
            logging.error(f"Image processing (answert) returned error: {result['error']}")
        return jsonify(result)
    
    except Exception as e:
        logging.error(f"Error occurred in /upload_image (type: {input_type}):", exc_info=True)
        return jsonify({"error": "Server error processing image."}), 500


@app.route('/upload_audio', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        logging.warning("Missing 'audio' file part in /upload_audio request")
        return jsonify({"error": "No audio file part"}), 400
    
    file = request.files['audio']
    if not file or file.filename == '':
        logging.warning("No audio file selected or invalid filename in /upload_audio")
        return jsonify({"error": "No audio file selected or invalid file"}), 400
    logging.info(f"Received audio upload. Filename: {file.filename}, MIME type: {file.mimetype}")

    try:
        audio_filename = 'audio.wav'
        audio_path = os.path.join(app.config['UPLOAD_FOLDER'], audio_filename)
        file.save(audio_path)
        logging.info(f"Saved audio to {audio_path}")
        result = answer()

        if result.get("error"):
            logging.error(f"Audio processing (answer) returned error: {result['error']}")
        return jsonify(result)
    
    except Exception as e:
        logging.error(f"Error occurred in /upload_audio:", exc_info=True)
        return jsonify({"error": "Server error processing audio."}), 500

# it was commented out for deployment. If u want to run locally on your system, remove the comments and use it.
# if __name__ == '__main__':
#     app.run(debug=True, host='0.0.0.0', port=5000)
