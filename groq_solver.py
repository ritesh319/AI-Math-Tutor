import os
import logging
from dotenv import load_dotenv
from groq import Groq
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

api_key = os.getenv("GROQ_API_KEY")
try:
    client = Groq(api_key=api_key)
    logging.info("Groq client initialized.")
except Exception as client_init_error:
    logging.error(f"Failed to initialize Groq client: {client_init_error}", exc_info=True)
    client = None

def solve_with_groq(expression):
    if client is None:
        logging.error("Groq client is not initialized. Cannot process request.")
        return {"error": "AI solver client is not configured correctly."}

    system_content = """You are a highly specialized math assistant. Your *only* function is to solve mathematical problems and explain mathematical concepts. You MUST use standard LaTeX formatting for all math: $$...$$ or \\[...\\] for display, \\(...\\) for inline (strictly no newlines around inline math).

CRITICAL INSTRUCTION: If the user input is NOT a recognizable mathematical problem, equation, concept query, or a request for a mathematical explanation, you MUST decline politely. Respond ONLY with a short refusal phrase like 'I specialize in mathematics and cannot answer questions outside of that domain.' or 'My apologies, I can only help with math-related problems.'

Do NOT answer non-math questions, write stories, provide general information, or engage in unrelated conversation. Focus exclusively on mathematics."""

    user_content = f"""Analyze the following input: "{expression}"

If it is a valid mathematical problem or question within your scope (mathematics only), solve it step-by-step using the required LaTeX formatting.
If it is NOT a mathematical problem or question, respond ONLY with the refusal phrase defined in the system prompt."""

    try:
        logging.info(f"Sending request to Groq for input: {expression[:50]}...")
        response = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content}
            ],
            temperature=0.1
        )
        solution = response.choices[0].message.content.strip()

        refusal_phrases = [
            "i specialize in mathematics and cannot answer questions outside of that domain",
            "my apologies, i can only help with math-related problems"
        ]
        if any(phrase in solution.lower() for phrase in refusal_phrases) and len(solution) < 100: # Basic check
             logging.info(f"Groq declined non-math question: {expression[:50]}")
        else:
             logging.info("Received successful math-related response from Groq.")


        return {
            "solution": solution
        }

    except Exception as e:
        logging.error(f"Error calling Groq API: {e}", exc_info=True)
        return {
            "error": "An error occurred while contacting the AI solver."
        }
