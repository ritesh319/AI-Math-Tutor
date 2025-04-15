import whisper
import os
import logging
from groq_solver import solve_with_groq # Assuming this works

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

try:
    whisper_model = whisper.load_model("base")
    logging.info("Whisper model 'base' loaded successfully.")
except Exception as model_load_error:
    logging.error(f"Failed to load Whisper model: {model_load_error}", exc_info=True)
    whisper_model = None


def transcribe_audio(audio_path):

    if whisper_model is None:
        logging.error("Whisper model is not loaded, cannot transcribe.")
        return None

    try:
        logging.info(f"Starting transcription for: {audio_path}")
        result = whisper_model.transcribe(audio_path)
        transcribed_text = result.get("text", "").strip()
        if transcribed_text:
            logging.info("Transcription successful.")
            return transcribed_text
        else:
            logging.warning("Transcription resulted in empty text.")
            return None
    except Exception as e:
        logging.error(f"Error during Whisper transcription: {e}", exc_info=True)
        return None


def answer():
    audio_path = os.path.join('uploads', 'audio.wav')

    try:
        math_text = transcribe_audio(audio_path)

        if math_text is None:
            return {"error": "Failed to transcribe audio or transcription was empty."}

        logging.info("Sending transcribed text to Groq.")
        output = solve_with_groq(math_text)

        # Add the original transcription for context
        output['original_extracted_text'] = math_text
        if 'expression' not in output:
            output['expression'] = math_text

        logging.info("Groq processing complete for audio transcription.")
        return output

    except FileNotFoundError:
        logging.error(f"Audio file not found at: {audio_path}")
        return {"error": "Uploaded audio file not found."}
    except Exception as e:
        logging.error(f"Unexpected error in answer (voice processing): {e}", exc_info=True)
        return {"error": "An unexpected server error occurred during audio processing."}
