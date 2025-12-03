import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processCensusCSV() {
  try {
    console.log('Processing consolidated_pincode_census.csv...');
    
    const csvPath = path.join(__dirname, '..', 'consolidated_pincode_census.csv');
    const outputPath = path.join(__dirname, '..', 'client', 'src', 'data', 'pincodePopulation.json');

    if (!fs.existsSync(csvPath)) {
      console.error(`CSV file not found at: ${csvPath}`);
      process.exit(1);
    }

    // Read CSV file
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      console.error('CSV file is empty or has no data rows');
      process.exit(1);
    }

    // Parse header
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.replace(/"/g, '').trim());
    
    // Find column indices
    const pincodeIndex = headers.findIndex(h => 
      h.toLowerCase() === 'pincode' || 
      h.toLowerCase().includes('pin')
    );
    const populationIndex = headers.findIndex(h => 
      h.toLowerCase() === 'persons' || 
      h.toLowerCase().includes('population') ||
      h.toLowerCase().includes('total population')
    );

    if (pincodeIndex === -1) {
      console.error('Pincode column not found in CSV');
      console.log('Available columns:', headers.slice(0, 10).join(', '), '...');
      process.exit(1);
    }

    if (populationIndex === -1) {
      console.error('Population column not found in CSV');
      console.log('Available columns:', headers.slice(0, 10).join(', '), '...');
      process.exit(1);
    }

    console.log(`Found pincode column: "${headers[pincodeIndex]}" (index ${pincodeIndex})`);
    console.log(`Found population column: "${headers[populationIndex]}" (index ${populationIndex})`);

    // Parse CSV properly (handle quoted values)
    function parseCSVLine(line) {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === '\n' || char === '\r') && !inQuotes) {
          result.push(current.trim());
          current = '';
          if (char !== ',') break;
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    }

    // Process data rows
    const pincodePopulation = {};
    let processedCount = 0;
    let skippedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      try {
        const values = parseCSVLine(lines[i]);
        const pincode = values[pincodeIndex]?.replace(/"/g, '').trim();
        const population = values[populationIndex]?.replace(/"/g, '').trim();

        if (pincode && population) {
          // Clean pincode (remove any non-numeric characters)
          const cleanPincode = pincode.replace(/\D/g, '');
          
          // Skip if pincode is not 6 digits
          if (cleanPincode.length !== 6) {
            skippedCount++;
            continue;
          }

          // Parse population (handle NA, empty, or numeric values)
          let popValue = null;
          if (population && population !== 'NA' && population !== '' && population.toLowerCase() !== 'na') {
            // Remove commas and parse
            const cleanPopulation = population.replace(/,/g, '').replace(/\D/g, '');
            if (cleanPopulation) {
              popValue = parseInt(cleanPopulation, 10);
            }
          }

          if (popValue && popValue > 0) {
            // If pincode already exists, use the larger population value (some pincodes might have multiple entries)
            if (pincodePopulation[cleanPincode]) {
              pincodePopulation[cleanPincode] = Math.max(pincodePopulation[cleanPincode], popValue);
            } else {
              pincodePopulation[cleanPincode] = popValue;
              processedCount++;
            }
          } else {
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error processing line ${i + 1}:`, error.message);
        skippedCount++;
      }
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save to JSON file
    fs.writeFileSync(outputPath, JSON.stringify(pincodePopulation, null, 2));
    
    console.log(`✓ Successfully processed ${processedCount} pincodes`);
    console.log(`✓ Skipped ${skippedCount} invalid entries`);
    console.log(`✓ Saved to ${outputPath}`);
    console.log(`✓ Sample pincodes:`, Object.keys(pincodePopulation).slice(0, 5).join(', '));

  } catch (error) {
    console.error('Error processing CSV file:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

processCensusCSV();

