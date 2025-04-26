from pix2tex.cli import LatexOCR
from PIL import Image
from groq_solver import solve_with_groq
import os
import pytesseract
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

TESSERACT_PATH = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
if os.path.exists(TESSERACT_PATH):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH
else:
    logging.warning(f"Tesseract executable not found at specified path: {TESSERACT_PATH}. "
                    "Ensure Tesseract is installed and in PATH if this path is incorrect.")

def answert(input_type="expression"):

    image_path = os.path.join('uploads', 'image.png')
    extracted_text = None
    latex_model = None 

    try:
        img = Image.open(image_path)

        if input_type == "word_problem":
            try:
                extracted_text = pytesseract.image_to_string(img)
                if not extracted_text or not extracted_text.strip():
                     logging.warning("Tesseract OCR resulted in empty text.")
                     return {"error": "Could not extract any text from the image."}
                logging.info("Tesseract extracted text successfully.")
            except pytesseract.TesseractNotFoundError:
                 logging.error("Tesseract is not installed or not found in PATH.")
                 return {"error": "Tesseract is not installed or configured correctly."}
            except Exception as tess_error:
                 logging.error(f"Error during Tesseract OCR: {tess_error}", exc_info=True)
                 return {"error": "An error occurred during text extraction."}

        elif input_type == "expression":
            try:
                if latex_model is None:
                   latex_model = LatexOCR()
                extracted_text = latex_model(img)
                print(extracted_text)
                if not extracted_text:
                    logging.warning("LatexOCR did not detect any math expression.")
                    return {"error": "Could not detect any math expression in the image."}
                logging.info("LatexOCR detected expression successfully.")
            except Exception as latex_error:
                 logging.error(f"Error during LatexOCR processing: {latex_error}", exc_info=True)
                 return {"error": "An error occurred during math expression detection."}

        else:
            logging.warning(f"Invalid input_type received: {input_type}")
            return {"error": f"Invalid input_type: '{input_type}'. Use 'expression' or 'word_problem'."}

        logging.info(f"Sending extracted content (type: {input_type}) to Groq.")
        output = solve_with_groq(extracted_text)

        output['original_input_type'] = input_type
        output['original_extracted_text'] = extracted_text

        if input_type == "expression" and 'expression' not in output:
             output['expression'] = extracted_text

        logging.info("Groq processing complete.")
        return output

    except FileNotFoundError:
        logging.error(f"Image file not found at: {image_path}")
        return {"error": "Uploaded image file not found."}
    except Exception as e:
        logging.error(f"Unexpected error in answert function: {e}", exc_info=True)
        return {"error": "An unexpected server error occurred during image processing."}
