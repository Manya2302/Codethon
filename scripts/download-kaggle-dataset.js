import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadKaggleDataset() {
  try {
    console.log('Downloading Kaggle dataset...');
    
    // Check if kaggle is installed
    try {
      execSync('kaggle --version', { stdio: 'ignore' });
    } catch (error) {
      console.error('Kaggle CLI not found. Please install it:');
      console.error('pip install kaggle');
      console.error('Then set up your Kaggle API credentials:');
      console.error('Place kaggle.json in ~/.kaggle/ (or C:\\Users\\<username>\\.kaggle\\ on Windows)');
      process.exit(1);
    }

    const datasetPath = path.join(__dirname, '..', 'data', 'kaggle-dataset');
    const outputPath = path.join(__dirname, '..', 'client', 'src', 'data', 'pincodePopulation.json');

    // Create directories if they don't exist
    if (!fs.existsSync(path.join(__dirname, '..', 'data'))) {
      fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
    }
    if (!fs.existsSync(path.join(__dirname, '..', 'client', 'src', 'data'))) {
      fs.mkdirSync(path.join(__dirname, '..', 'client', 'src', 'data'), { recursive: true });
    }

    // Download dataset using Kaggle CLI
    console.log('Downloading dataset: karthikeyanbalakumar/pincode-district-census-data-for-control-variables');
    execSync(`kaggle datasets download -d karthikeyanbalakumar/pincode-district-census-data-for-control-variables -p "${datasetPath}" --unzip`, {
      stdio: 'inherit'
    });

    // Find CSV files in the downloaded dataset
    const files = fs.readdirSync(datasetPath);
    const csvFiles = files.filter(file => file.endsWith('.csv'));

    if (csvFiles.length === 0) {
      console.error('No CSV files found in the dataset');
      return;
    }

    console.log(`Found ${csvFiles.length} CSV file(s)`);

    // Process the first CSV file (assuming it contains pincode and population data)
    const csvFile = path.join(datasetPath, csvFiles[0]);
    console.log(`Processing file: ${csvFile}`);

    // Read and parse CSV (handle both comma and other delimiters)
    const csvContent = fs.readFileSync(csvFile, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Try to detect delimiter
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes(';')) {
      delimiter = ';';
    }
    
    // Parse CSV properly (handle quoted values)
    function parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === delimiter || char === '\n' || char === '\r') && !inQuotes) {
          result.push(current.trim());
          current = '';
          if (char !== delimiter) break;
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }
    
    const headers = parseCSVLine(firstLine).map(h => h.replace(/"/g, '').toLowerCase());

    // Find pincode and population columns
    const pincodeIndex = headers.findIndex(h => 
      h.includes('pincode') || 
      h.includes('pin code') ||
      h.includes('pin') || 
      h.includes('postal') ||
      h.includes('postcode')
    );
    const populationIndex = headers.findIndex(h => 
      h.includes('population') || 
      h.includes('pop') ||
      h.includes('census') ||
      h.includes('total population')
    );

    if (pincodeIndex === -1) {
      console.error('Pincode column not found in CSV');
      console.log('Available columns:', headers);
      return;
    }

    if (populationIndex === -1) {
      console.error('Population column not found in CSV');
      console.log('Available columns:', headers);
      return;
    }

    console.log(`Pincode column: ${headers[pincodeIndex]}`);
    console.log(`Population column: ${headers[populationIndex]}`);

    // Parse data and create lookup object
    const pincodePopulation = {};
    let processedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      const pincode = values[pincodeIndex]?.replace(/"/g, '').trim();
      const population = values[populationIndex]?.replace(/"/g, '').trim();

      if (pincode && population) {
        // Clean pincode (remove any non-numeric characters)
        const cleanPincode = pincode.replace(/\D/g, '');
        if (cleanPincode.length === 6) {
          const popValue = parseInt(population.replace(/\D/g, ''), 10);
          if (!isNaN(popValue) && popValue > 0) {
            pincodePopulation[cleanPincode] = popValue;
            processedCount++;
          }
        }
      }
    }

    // Save to JSON file
    fs.writeFileSync(outputPath, JSON.stringify(pincodePopulation, null, 2));
    console.log(`✓ Processed ${processedCount} pincodes`);
    console.log(`✓ Saved to ${outputPath}`);

    // Clean up downloaded dataset (optional)
    // fs.rmSync(datasetPath, { recursive: true, force: true });

  } catch (error) {
    console.error('Error downloading/processing Kaggle dataset:', error.message);
    console.error('Make sure you have:');
    console.error('1. Kaggle CLI installed: pip install kaggle');
    console.error('2. Kaggle API credentials set up in ~/.kaggle/kaggle.json');
    process.exit(1);
  }
}

downloadKaggleDataset();

