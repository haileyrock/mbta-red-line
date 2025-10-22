# MBTA Red Line Daily Alert System

Automated email notifications for Red Line MBTA delays and alerts, sent every morning at 7:00 AM.

## Features

- 📧 Sends daily email updates about Red Line status
- ⚠️ Highlights active delays and disruptions
- 📅 Shows upcoming planned maintenance
- 🟢 Confirms when there are no alerts
- 🎨 Clean HTML and plain text email formatting
- ⏰ Runs automatically at 7:00 AM daily

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Email Settings

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and add your email credentials:

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
RECIPIENT_EMAIL=your-email@gmail.com
```

#### Gmail Setup

If using Gmail, you need to create an **App Password**:

1. Go to your Google Account settings
2. Navigate to Security → 2-Step Verification (enable if not already)
3. Go to Security → App passwords
4. Generate a new app password for "Mail"
5. Use this 16-character password in your `.env` file

#### Other Email Services

For other email providers, update `EMAIL_SERVICE` accordingly:
- `outlook` for Outlook/Hotmail
- `yahoo` for Yahoo Mail
- Or configure custom SMTP settings in [index.js](index.js)

### 3. Run the Application

**Test immediately:**
```bash
npm run start -- --now
```

**Run on schedule (7:00 AM daily):**
```bash
npm start
```

## Running 24/7

To keep the script running continuously:

### Option 1: Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start index.js --name mbta-alerts
pm2 save
pm2 startup
```

### Option 2: Using systemd (Linux)

Create `/etc/systemd/system/mbta-alerts.service`:

```ini
[Unit]
Description=MBTA Red Line Alert Service
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/mbta
ExecStart=/usr/bin/node index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable mbta-alerts
sudo systemctl start mbta-alerts
```

### Option 3: Cloud Deployment

Deploy to a cloud platform that runs continuously:
- **Heroku**: Add a `Procfile` with `worker: node index.js`
- **Railway**: Connect your repo and deploy
- **AWS EC2/DigitalOcean**: Run with PM2 as above

## Customization

### Change Schedule

Edit the `CRON_SCHEDULE` in your `.env` file:

```env
# Run at 6:30 AM
CRON_SCHEDULE=30 6 * * *

# Run at 7:00 AM and 5:00 PM
CRON_SCHEDULE=0 7,17 * * *
```

Cron format: `minute hour day month weekday`

### Modify Alert Filtering

Edit the `mbtaApiUrl` in [index.js](index.js:27) to change routes or add filters:

```javascript
// Multiple routes
mbtaApiUrl: 'https://api-v3.mbta.com/alerts?filter[route]=Red,Orange'

// Specific activities
mbtaApiUrl: 'https://api-v3.mbta.com/alerts?filter[route]=Red&filter[activity]=BOARD'
```

## Troubleshooting

**Email not sending:**
- Verify your email credentials in `.env`
- Check that 2FA and app passwords are set up correctly
- Look for error messages in the console

**No alerts showing:**
- The Red Line might genuinely have no alerts!
- Test with `--now` flag to verify the system works

**Script stops running:**
- Use PM2 or systemd for auto-restart
- Check system logs for errors

## API Reference

This project uses the [MBTA V3 API](https://api-v3.mbta.com/docs/swagger/index.html).

Alert endpoint: `https://api-v3.mbta.com/alerts?filter[route]=Red`

## License

ISC
