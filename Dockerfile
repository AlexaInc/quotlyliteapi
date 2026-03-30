FROM mcr.microsoft.com/playwright/python:v1.40.0-focal

# Set working directory
WORKDIR /app

# Install Python dependencies from requirements.txt
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy all local project files into the container
COPY . .

# Install Playwright browsers
RUN playwright install chromium

# Set Environment
ENV PORT=7860
EXPOSE 7860

# Start Gradio
CMD ["python3", "app.py"]
