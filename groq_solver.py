import os
import logging
from dotenv import load_dotenv
from groq import Groq
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

api_key = os.getenv("GROQ_API_KEY")

client = None
if api_key:
    try:
        client = Groq(api_key=api_key)
        logging.info("Groq client initialized.")
    except Exception as client_init_error:
        logging.error(f"Failed to initialize Groq client: {client_init_error}", exc_info=True)
        client = None
else:
    logging.warning("GROQ_API_KEY environment variable not set. Groq client not initialized.")


def solve_with_groq(user_query, referenced_message_content=None):

    if client is None:
        logging.error("Groq client is not initialized. Cannot process request.")
        return {"error": "AI solver client is not configured correctly."}

    system_content = """You are Axiom, a specialized math assistant. Your goal is to be helpful with mathematical tasks.

Key Instructions:
1.  **Answer Mathematical Queries:** Your scope includes solving problems (algebra, calculus, etc.), explaining mathematical concepts, defining terms (like 'what is sin x'), describing function properties, and performing calculations. Use standard LaTeX format (`$$...$$` display, `\\(...\\)` inline) for all mathematical notation. Provide clear steps when solving problems.
2.  **Handle Corrections:** If user feedback is provided regarding your previous response (context included), treat generating a correction as a **priority mathematical task**. Analyze the feedback and the previous response, then provide a revised mathematical answer. This overrides the refusal rule if the feedback relates to a previous math answer. Acknowledge the feedback briefly (e.g., "You're right, let me fix the range...") before the correction.
3.  **Refuse Non-Math Politely:** If the user input is clearly NOT a mathematical query (as defined in rule 1) AND is NOT feedback on a previous math answer, respond ONLY with the exact phrase: "I can only assist with math-related problems." Do not add any other explanation.
4.  **Plot ONLY When Asked:** Include `[PLOT func='...' x_min=... x_max=... steps=...]` (using numerical ranges, math.js syntax) **ONLY IF** the user query explicitly asks to 'plot', 'graph', 'draw', or 'visualize' a 2D function. Never include the plot tag otherwise.
5.  **No Meta-Commentary:** Do not state if a query is valid/invalid. Just answer or refuse according to the rules.

**<<< Graphing Instruction (Details Updated) >>>**
- **ONLY if the user explicitly asks for a plot/graph/visualization/drawing of a 2D function y=f(x):** AFTER the text/LaTeX explanation, include the tag `[PLOT func='...' x_min=... x_max=... steps=...]` on its own line.
- `func`: Use standard math.js syntax (e.g., 'sin(x)', 'x^2', 'exp(-x^2/2)'). Use 'x' as the variable. Use `*` for multiplication, `^` for exponentiation.
- `x_min`, `x_max`: **MUST be specific NUMERICAL values** (e.g., -5, 3.14, 100, -2e-3). **CRITICAL: DO NOT use variables like 'x' or constants like 'pi' in `x_min` or `x_max`**. You must provide actual numbers defining the plot range. Ensure x_max > x_min.
- `steps`: A reasonable integer (e.g., 100-500). Must be > 1.
- **Correct Example:** `[PLOT func='x^2' x_min=-5 x_max=5 steps=100]`
- **Incorrect Example:** `[PLOT func='x^2' x_min=-2*x x_max=2*x steps=100]` (Uses 'x' in range)
- **Incorrect Example:** `[PLOT func='sin(x)' x_min=-pi x_max=pi steps=100]` (Uses 'pi' in range)
"""


    if referenced_message_content:
        user_content = f"""My previous mathematical response was:
\"\"\"
{referenced_message_content}
\"\"\"
The user's feedback/correction is: "{user_query}"

Generate a revised mathematical answer addressing the feedback. Follow all system prompt rules, including LaTeX and plotting only if requested in the *current* feedback (using numerical ranges)."""
        log_prefix = "Sending correction context to Groq"
    else:
        user_content = f"""User query: "{user_query}"

Respond to this query according to the system prompt rules. Determine if it's a mathematical query (solve/explain/define) or if it requires refusal. Remember plot tag details (numerical ranges only!)."""
        log_prefix = "Sending new query context to Groq"


    try:
        logging.info(f"{log_prefix}. User query: {user_query[:60]}...")
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content}
            ],
            temperature=0.3
        )
        solution = response.choices[0].message.content.strip()

        refusal_phrase = "I can only assist with math-related problems."
        solution_lower = solution.lower()
        is_refusal = (solution == refusal_phrase) or \
                     ("only assist with math-related problems" in solution_lower and len(solution) < 100) or \
                     ("specialize in mathematics and cannot answer" in solution_lower and len(solution) < 100)

        if is_refusal:
            if not referenced_message_content or "I can only assist" in solution:
                 logging.warning(f"Groq declined input as non-math: {user_query[:60]} -> Response: {solution[:60]}...")
            else:
                 logging.warning(f"Groq potentially refused correction context. User query: {user_query[:60]} -> Response: {solution[:60]}...")
        elif referenced_message_content:
            logging.info("Received corrected response from Groq.")
        else:
            logging.info("Received standard math response from Groq.")
        if "[PLOT " in solution:
            logging.info("Groq response includes a [PLOT] tag.")


        return {"solution": solution}

    except Exception as e:
        logging.error(f"Error calling Groq API: {e}", exc_info=True)
        return {"error": "An error occurred while contacting the AI solver."}