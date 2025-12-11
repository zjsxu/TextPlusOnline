from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return "hello"

app.run(port=5000, debug=False)