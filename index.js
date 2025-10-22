import cron from 'node-cron';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    });
  }
}

loadEnv();

// Configuration
const config = {
  emailService: process.env.EMAIL_SERVICE || 'gmail',
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  recipientEmail: process.env.RECIPIENT_EMAIL,
  cronSchedule: process.env.CRON_SCHEDULE || '0 7 * * *', // 7:00 AM every day
  mbtaApiUrl: 'https://api-v3.mbta.com/alerts?filter[route]=Red'
};

// Validate configuration
if (!config.emailUser || !config.emailPassword || !config.recipientEmail) {
  console.error('Error: Missing email configuration. Please create a .env file with EMAIL_USER, EMAIL_PASSWORD, and RECIPIENT_EMAIL');
  console.error('See .env.example for reference');
  process.exit(1);
}

// Create email transporter
const transporter = nodemailer.createTransport({
  service: config.emailService,
  auth: {
    user: config.emailUser,
    pass: config.emailPassword
  }
});

// Fetch Red Line alerts from MBTA API
async function fetchRedLineAlerts() {
  try {
    const response = await fetch(config.mbtaApiUrl);
    if (!response.ok) {
      throw new Error(`MBTA API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching MBTA alerts:', error);
    throw error;
  }
}

// Format alerts into readable email content
function formatAlerts(alerts) {
  if (!alerts || alerts.length === 0) {
    return {
      subject: '🟢 Red Line Status: No Alerts',
      html: `
        <h2>Good Morning!</h2>
        <p><strong style="color: green;">✓ No delays or alerts on the Red Line</strong></p>
        <p>The Red Line is running normally. Have a great commute!</p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          Generated at ${new Date().toLocaleString()}<br>
          Data from <a href="https://www.mbta.com/alerts/subway?route=Red">MBTA Alerts</a>
        </p>
      `,
      text: `Good Morning!\n\n✓ No delays or alerts on the Red Line\n\nThe Red Line is running normally. Have a great commute!\n\nGenerated at ${new Date().toLocaleString()}`
    };
  }

  // Categorize alerts by severity/effect
  const activeAlerts = alerts.filter(alert => {
    const attrs = alert.attributes;
    const now = new Date();

    // Check if alert is currently active
    if (attrs.active_period && attrs.active_period.length > 0) {
      return attrs.active_period.some(period => {
        const start = period.start ? new Date(period.start) : null;
        const end = period.end ? new Date(period.end) : null;

        if (!start) return true; // No start time means it's active
        if (start > now) return false; // Hasn't started yet
        if (end && end < now) return false; // Already ended
        return true; // Currently active
      });
    }
    return true; // No period specified, assume active
  });

  const upcomingAlerts = alerts.filter(alert => {
    const attrs = alert.attributes;
    const now = new Date();

    if (attrs.lifecycle === 'UPCOMING') {
      return !activeAlerts.includes(alert);
    }
    return false;
  });

  let html = '<h2>Red Line Status Update</h2>';
  let text = 'Red Line Status Update\n\n';
  let subject = '🔴 Red Line Status: ';

  if (activeAlerts.length > 0) {
    subject += `${activeAlerts.length} Active Alert${activeAlerts.length > 1 ? 's' : ''}`;

    html += `<h3 style="color: #d9534f;">⚠️ Active Alerts (${activeAlerts.length})</h3>`;
    text += `⚠️ ACTIVE ALERTS (${activeAlerts.length})\n${'='.repeat(50)}\n\n`;

    activeAlerts.forEach((alert, index) => {
      const attrs = alert.attributes;
      const effect = attrs.effect || 'Unknown';
      const severity = attrs.severity || 'N/A';
      const header = attrs.header || 'No header available';
      const description = attrs.description || '';
      const url = attrs.url || 'https://www.mbta.com';

      html += `
        <div style="background-color: #f8d7da; padding: 15px; margin: 10px 0; border-left: 4px solid #d9534f;">
          <h4 style="margin-top: 0;">Alert ${index + 1}: ${effect}</h4>
          <p><strong>${header}</strong></p>
          ${description ? `<p>${description}</p>` : ''}
          <p style="font-size: 12px;">
            <strong>Severity:</strong> ${severity}/10<br>
            <strong>Cause:</strong> ${attrs.cause || 'Unknown'}<br>
            ${attrs.service_effect ? `<strong>Service Effect:</strong> ${attrs.service_effect}<br>` : ''}
            <a href="${url}">More Info</a>
          </p>
        </div>
      `;

      text += `Alert ${index + 1}: ${effect}\n`;
      text += `${header}\n`;
      if (description) text += `${description}\n`;
      text += `Severity: ${severity}/10 | Cause: ${attrs.cause || 'Unknown'}\n`;
      text += `More info: ${url}\n\n`;
    });
  } else {
    subject += 'No Current Delays';
    html += '<p style="color: green;"><strong>✓ No active delays on the Red Line</strong></p>';
    text += '✓ No active delays on the Red Line\n\n';
  }

  if (upcomingAlerts.length > 0) {
    html += `<h3 style="color: #f0ad4e;">📅 Upcoming Alerts (${upcomingAlerts.length})</h3>`;
    text += `\n📅 UPCOMING ALERTS (${upcomingAlerts.length})\n${'='.repeat(50)}\n\n`;

    upcomingAlerts.forEach((alert, index) => {
      const attrs = alert.attributes;
      const header = attrs.header || 'No header available';
      const activePeriod = attrs.active_period?.[0];
      const startDate = activePeriod?.start ? new Date(activePeriod.start).toLocaleDateString() : 'TBD';

      html += `
        <div style="background-color: #fcf8e3; padding: 15px; margin: 10px 0; border-left: 4px solid #f0ad4e;">
          <h4 style="margin-top: 0;">${header}</h4>
          <p style="font-size: 12px;"><strong>Starts:</strong> ${startDate}</p>
        </div>
      `;

      text += `${header}\nStarts: ${startDate}\n\n`;
    });
  }

  html += `
    <hr>
    <p style="font-size: 12px; color: #666;">
      Generated at ${new Date().toLocaleString()}<br>
      Data from <a href="https://www.mbta.com/alerts/subway?route=Red">MBTA Alerts</a>
    </p>
  `;

  text += `\nGenerated at ${new Date().toLocaleString()}\nData from https://www.mbta.com/alerts/subway?route=Red`;

  return { subject, html, text };
}

// Send email with alert information
async function sendAlertEmail() {
  try {
    console.log(`[${new Date().toLocaleString()}] Fetching Red Line alerts...`);
    const alerts = await fetchRedLineAlerts();

    console.log(`Found ${alerts.length} total alerts`);

    const { subject, html, text } = formatAlerts(alerts);

    const mailOptions = {
      from: config.emailUser,
      to: config.recipientEmail,
      subject: subject,
      text: text,
      html: html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ Email sent successfully: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Error sending alert email:', error);

    // Try to send error notification
    try {
      await transporter.sendMail({
        from: config.emailUser,
        to: config.recipientEmail,
        subject: '❌ Red Line Alert System Error',
        text: `Failed to fetch or send Red Line alerts.\n\nError: ${error.message}\n\nTime: ${new Date().toLocaleString()}`
      });
    } catch (emailError) {
      console.error('Failed to send error notification:', emailError);
    }

    return false;
  }
}

// Main execution
console.log('Red Line MBTA Alert System Starting...');
console.log(`Scheduled to run at: ${config.cronSchedule} (7:00 AM daily)`);
console.log(`Sending alerts to: ${config.recipientEmail}`);

// Run immediately if --now flag is passed
if (process.argv.includes('--now')) {
  console.log('\n--now flag detected, running immediately...\n');
  sendAlertEmail().then(() => {
    console.log('\nDone! To run on schedule, restart without --now flag');
    process.exit(0);
  });
} else {
  // Schedule the job to run at 7:00 AM every day
  cron.schedule(config.cronSchedule, () => {
    console.log('\n--- Scheduled job triggered ---');
    sendAlertEmail();
  });

  console.log('\n✓ Scheduler is running. Press Ctrl+C to stop.');
  console.log('Tip: Run with --now flag to test immediately: node index.js --now\n');
}
