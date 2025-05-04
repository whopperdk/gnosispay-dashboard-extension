# gnosispay-dashboard-extension
A browser extension that enhances the GnosisPay dashboard with transaction analysis features.

![Extension Screenshot]([extension/screenshot.png])

## Features

- **Spending Analysis**: Visualise spending by category with interactive pie charts
- **Yearly Overview**: View spending trends over time with histogram charts
- **Cashback Calculator**: Estimate potential cashback earnings
- **MCC Insights**: See merchant category codes and cashback eligibility
- **Data Export**: Export transaction history to CSV

## Installation

### Chrome/Edge/Brave

1. Download this repository
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `/extension` folder

### Firefox

1. Download this repository
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select any file in the `/extension` folder

## Usage

1. Log in to your GnosisPay account at https://app.gnosispay.com/
2. Navigate to the Card or Wallet section
3. The extension will automatically enhance your transaction view with:
   - MCC codes and cashback eligibility indicators
   - Spending analysis charts
   - Cashback calculation tools

## Features in Detail

### Spending Analysis
- Monthly breakdown by category
- Interactive pie chart with category highlighting
- Total spending summary

### Yearly Overview
- Annual spending trends
- Category comparison across years
- Automatic scaling for optimal visualization

### Cashback Calculator
- Select a week to analyze
- Enter your GNO token amount
- Toggle OG NFT ownership
- See estimated cashback amount and rate

## Development

To modify or extend the extension:

1. Clone this repository
2. Make changes to `content.js`
3. Test by reloading the extension in your browser
4. Submit a pull request with your improvements

## License

MIT License
