from flask import Flask, render_template, request, jsonify
import os
import traceback
from pt import answert
from voice import answer
from groq_solver import solve_with_groq

app = Flask(__name__)


UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # Limit file size (16MB)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.route('/')
def index():
    """Serves the main chat page."""
    return render_template('index.html')


@app.route('/solve_text', methods=['POST'])
def solve_text():
    """Handles text query submission and returns Groq solution."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()
    text_query = data.get('query')

    if not text_query:
        return jsonify({"error": "No query provided"}), 400

    try:
        result = solve_with_groq(text_query)
        return jsonify(result)
    except Exception as e:
        print(f"Error in /solve_text: {e}") 
        return jsonify({"error": "Server error processing text query."}), 500


@app.route('/upload_image', methods=['POST'])
def upload_image():
    """Handles image upload, processes based on input_type, returns solution."""
    if 'image' not in request.files:
        return jsonify({"error": "No image file part in the request"}), 400

    file = request.files['image']
    if not file or file.filename == '':
        return jsonify({"error": "No image file selected or invalid file"}), 400

    input_type = request.form.get('input_type', 'expression').strip().lower()

    try:

        image_filename = 'image.png'
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], image_filename)
        file.save(image_path)

        result = answert(input_type=input_type)
        return jsonify(result)

    except Exception as e:
        print(f"Error occurred in /upload_image (type: {input_type}):")
        traceback.print_exc() 
        return jsonify({"error": "Server error processing image."}), 500


@app.route('/upload_audio', methods=['POST'])
def upload_audio():
    """Handles audio upload, processes, and returns solution."""
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file part"}), 400

    file = request.files['audio']
    if not file or file.filename == '':
        return jsonify({"error": "No audio file selected or invalid file"}), 400

    try:
        audio_filename = 'audio.wav'
        audio_path = os.path.join(app.config['UPLOAD_FOLDER'], audio_filename)
        file.save(audio_path)

        # Process audio
        result = answer()
        return jsonify(result)

    except Exception as e:
        print(f"Error occurred in /upload_audio:")
        traceback.print_exc() 
        return jsonify({"error": "Server error processing audio."}), 500

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))  # Use Render's PORT or default to 5000
    app.run(debug=False, host='0.0.0.0', port=port)
