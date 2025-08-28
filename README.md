# Intentional Browsing

A browser extension that adds a mindful barrier before accessing distracting websites, helping you browse the internet more intentionally.

## Features

- **Mindful Blocking**: Redirects you to a reflection screen before accessing blocked sites
- **Intentional Access**: Requires you to provide a thoughtful reason (minimum 100 characters) before proceeding
- **Time Awareness**: Set time limits for your visits with automatic redirection after the session expires
- **Visit History**: Track your browsing patterns with a day-by-day view of your site visits
- **Reflection Journal**: Post-visit reflection prompts to help you evaluate your browsing habits
- **Temporary Blocking**: Option to block yourself from sites for specified periods
- **Customizable Site List**: Easy management of which sites to block through the options page

## How It Works

1. **Block Setup**: Configure which websites you want to review before accessing
2. **Mindful Barrier**: When you try to visit a blocked site, you're redirected to a reflection screen
3. **Intentional Entry**: Provide a meaningful reason for your visit (minimum 100 characters)
4. **Time Commitment**: Set how long you plan to spend on the site
5. **Session Management**: Browse freely within your time limit
6. **Reflection**: When your session ends, reflect on your visit and its value
7. **History Tracking**: Review your browsing patterns and reflections over time

## Installation

### Firefox
1. Download the extension files
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" → "Load Temporary Add-on"
4. Select the `manifest.json` file

### Chrome/Edge (Developer Mode)
1. Download the extension files
2. Open Chrome/Edge and navigate to `chrome://extensions/` or `edge://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension folder

## Configuration

1. After installation, right-click the extension icon and select "Options"
2. Add websites you want to block (e.g., `twitter.com`, `facebook.com`, `youtube.com`)
3. Sites are matched by domain, including subdomains

## File Structure

- `manifest.json` - Extension configuration and permissions
- `background.js` - Core blocking logic and session management
- `block.html/css/js` - Mindful barrier interface
- `options.html/js` - Configuration page for blocked sites
- `reflect.html/js` - Post-visit reflection interface

## Privacy

All data is stored locally in your browser using the extension's storage API. No data is transmitted to external servers.

## License

This project is open source. Feel free to modify and distribute according to your needs.