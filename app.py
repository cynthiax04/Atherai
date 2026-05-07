from flask import Flask, render_template, request, redirect, session, jsonify, g
import sqlite3, os, requests
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "super-secret-key"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "assistant.db")

# ---------------- DATABASE ----------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH, timeout=10, check_same_thread=False)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(error=None):
    db = g.pop("db", None)
    if db:
        db.close()

# ---------------- HOME ----------------
@app.route("/")
def home():
    logged_in = "user_id" in session
    username = session.get("username")

    chats = []
    if logged_in:
        db = get_db()
        chats = db.execute(
            "SELECT message, response FROM chats WHERE user_id=? ORDER BY timestamp DESC",
            (session["user_id"],)
        ).fetchall()

    return render_template(
        "index.html",
        chats=chats,
        logged_in=logged_in,
        username=username
    )

# ---------------- SIGNUP ----------------
@app.route("/signup", methods=["GET", "POST"])
def signup():
    error = None
    if request.method == "POST":
        try:
            db = get_db()
            db.execute(
                "INSERT INTO users (username, password) VALUES (?, ?)",
                (request.form["username"],
                 generate_password_hash(request.form["password"]))
            )
            db.commit()
            return redirect("/login")
        except sqlite3.IntegrityError:
            error = "User already exists"

    return render_template("signup.html", error=error)

# ---------------- LOGIN ----------------
@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        db = get_db()
        user = db.execute(
            "SELECT * FROM users WHERE username=?",
            (request.form["username"],)
        ).fetchone()

        if user and check_password_hash(user["password"], request.form["password"]):
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            return redirect("/")

        error = "Invalid username or password"

    return render_template("login.html", error=error)

# ---------------- LOGOUT ----------------
@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")

# ---------------- CHAT ----------------
@app.route("/chat", methods=["POST"])
def chat():

    data = request.get_json()
    user_msg = data.get("message", "").strip()

    if not user_msg:
        return jsonify({
            "response": "Please enter a message.",
            "guest": "user_id" not in session
        })

    # MEMORY
    if "chat_memory" not in session:
        session["chat_memory"] = []

    session["chat_memory"].append({
        "role": "user",
        "content": user_msg
    })

    conversation = ""

    for msg in session["chat_memory"][-6:]:
        conversation += f"{msg['role']}: {msg['content']}\n"

    conversation += "assistant:"

    try:

        res = requests.post(
            "http://localhost:11434/api/generate",

            json={
                "model": "tinyllama",
                "prompt": conversation,
                "stream": False
            },

            timeout=60
        )

        print("STATUS:", res.status_code)
        print("RAW:", res.text)

        if res.status_code != 200:
            raise Exception("Ollama API failed")

        response_json = res.json()

        ai_response = response_json.get("response", "")

        if not ai_response:
            raise Exception("Empty AI response")

        session["chat_memory"].append({
            "role": "assistant",
            "content": ai_response
        })

    except Exception as e:

        print("AI ERROR:", str(e))

        return jsonify({
            "response": f"⚠️ {str(e)}",
            "guest": "user_id" not in session
        })

    # SAVE DATABASE
    if "user_id" in session:

        db = get_db()

        db.execute(
            "INSERT INTO chats (user_id, message, response) VALUES (?, ?, ?)",
            (session["user_id"], user_msg, ai_response)
        )

        db.commit()

    return jsonify({
        "response": ai_response,
        "guest": "user_id" not in session
    })


# ---------------- CLEAR CHAT ----------------
@app.route("/clear-chat", methods=["POST"])
def clear_chat():

    session.pop("chat_memory", None)

    return jsonify({
        "success": True
    })


if __name__ == "__main__":
    app.run(debug=False)