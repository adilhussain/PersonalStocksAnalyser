FROM python:3.8-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
  libpq-dev \
  gcc

COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt

COPY . .

# Add the shell script
COPY run_scripts.sh .

RUN chmod +x run_scripts.sh


CMD ["./run_scripts.sh"]
