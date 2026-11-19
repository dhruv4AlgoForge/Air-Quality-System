# Air Quality System

Exploratory data analysis of Mumbai air quality (2021-2023) using Python. A real-time multi-city AQI monitoring app (FastAPI + WAQI API) will be added to this repo.

## Mumbai AQI Exploratory Data Analysis (2021-2023)

### Objective
Understand how air quality in Mumbai changed from 2021 to 2023, which pollutants and areas drive it, and how it varies by season.

### Dataset
- Source: [add your Kaggle dataset link here]
- 1.6M records at 15-minute intervals from 21 monitoring stations
- Pollutants: PM2.5, PM10, NO, NO2, NOx, NH3, SO2, CO, Ozone, Benzene
- The dataset is not included because of its size. Download it from the link above and place it next to the notebook.

### Key Findings
- Average PM2.5 rose from 47.9 (2021) to 49.3 (2022) to 89.2 (2023) ug/m3, 5.9x the WHO limit in 2023
- Mazgaon had the highest average PM2.5 (78.0 ug/m3)
- Winter PM2.5 (70.9 ug/m3) was about double the monsoon level (34.8 ug/m3)
- PM2.5 and PM10 are strongly correlated (r = 0.75)

### Methods
- Cleaning and merging of multiple CSV files
- AQI calculation and time features (year, month, season, hour)
- Trend, seasonal and station-level analysis
- Correlation heatmaps, box plots and distribution plots

### Tools
Python, Pandas, NumPy, Matplotlib, Seaborn, Jupyter Notebook

### Files
- `finalaqi.ipynb` - full analysis notebook

### Note
Some cells in the notebook (pollution source shares, forecast scenarios, disease and premature-death estimates) use illustrative values based on published studies, not values computed from this dataset.

## Author
Dhruv Panchal - [LinkedIn](https://linkedin.com/in/dhruv-panchal-a14865258)
