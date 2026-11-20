# Air Quality System

Two connected projects on Mumbai and city air quality: an exploratory data analysis of 2021-2023 Mumbai data, and a real-time multi-city AQI monitoring web app built with FastAPI and the WAQI API.

## Repository Structure
- `finalaqi.ipynb` - Part 1: exploratory data analysis notebook
- `main.py`, `templates/`, `static/` - Part 2: AeroVision real-time AQI app
- `requirements.txt` - Python dependencies for the app
- `.env.example` - example of the environment file the app needs

---

## Part 1: Mumbai AQI Exploratory Data Analysis (2021-2023)

### Objective
Understand how air quality in Mumbai changed from 2021 to 2023, which pollutants and areas drive it, and how it varies by season.

### Dataset
- Source: [Air Quality Index (AQI) Data of Mumbai on Kaggle](https://www.kaggle.com/datasets/gyaswanth297/air-quality-indexaqi-data-of-mumbai)
- 21 station CSV files, merged into one file of about 1.6M records at 15-minute intervals
- Pollutants: PM2.5, PM10, NO, NO2, NOx, NH3, SO2, CO, Ozone, Benzene
- The data is not included because of its size. Download the 21 files from the Kaggle link, merge them into `mumbai_merged_all_csv_files.csv`, and place it in the same folder as the notebook.

### Key Findings
- Average PM2.5 rose from 47.9 (2021) to 49.3 (2022) to 89.2 (2023) ug/m3, 5.9x the WHO limit in 2023
- Mazgaon had the highest average PM2.5 (78.0 ug/m3) and Bandra the lowest
- Winter PM2.5 (70.9 ug/m3) was about double the monsoon level (34.8 ug/m3)
- PM2.5 and PM10 are strongly correlated (r = 0.75)

### Methods
- Cleaning and merging of multiple CSV files
- AQI calculation and time features (year, month, season, hour)
- Trend, seasonal and station-level analysis
- Correlation heatmaps, box plots and distribution plots

### Tools
Python, Pandas, NumPy, Matplotlib, Seaborn, Jupyter Notebook

### Note
Some cells in the notebook (pollution source shares, forecast scenarios, disease and premature-death estimates) use illustrative values based on published studies, not values computed from this dataset.

---

## Part 2: AeroVision - Real-Time AQI Monitoring App

A web app that shows live air quality for multiple cities using the WAQI API.

### Features
- Live AQI and 6 pollutants (PM2.5, PM10, NO2, SO2, CO, O3) for any city
- Compare up to 4 cities side by side
- AQI category with health recommendations
- Recent AQI history for each city viewed

### Tech Stack
Python, FastAPI, Uvicorn, Requests, WAQI API, HTML, CSS, JavaScript

### Setup
1. Clone the repo and open the folder in a terminal.
2. Install dependencies: `pip install -r requirements.txt`
3. Get a free API token from the WAQI website (aqicn.org/data-platform/token).
4. Create a file named `.env` in the same folder as `main.py` with one line: `WAQI_TOKEN=your_token_here`
5. Run the app: `python main.py`
6. Open `http://127.0.0.1:8080` in your browser.

The `.env` file is ignored by Git, so your token is never uploaded.

---

## Author
Dhruv Panchal - [LinkedIn](https://linkedin.com/in/dhruv-panchal-a14865258)
