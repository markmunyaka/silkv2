# 📧 Email Mailer Feature

A powerful, flexible email campaign management system built into your PDF Summarize application. Send beautiful HTML emails to your business leads with support for multiple email service providers.

## ✨ Features

### 🎨 Email Template Management
- Create custom HTML email templates with a visual editor
- Support for dynamic variables ({{firstName}}, {{lastName}}, etc.)
- Preview emails before sending
- Edit and delete templates
- Template descriptions for organization

### 📧 Recipient Management
- Import business email leads via CSV files
- Support for email, firstName, and lastName columns
- Organize recipients into lists
- View recipient list statistics

### 🚀 Campaign Management
- Create campaigns by selecting template + recipient list
- Configure sender information (email, name)
- Choose email provider (Nodemailer, SendGrid)
- Draft campaigns for safe testing
- Send campaigns to all recipients with one click
- Track sent/failed emails with detailed logging

### 🔧 Multi-Provider Support
- **Nodemailer**: SMTP-based email sending (Gmail, custom SMTP servers)
- **SendGrid**: Enterprise email service
- Extensible architecture for adding more providers
- Switch providers without code changes

### 📊 Campaign Analytics
- Track total recipients, sent, and failed emails
- Success rate calculation
- Email delivery logs
- Campaign history

## 🚀 Getting Started

### Access the Mailer Dashboard

Navigate to `/mailer` in your application to access the Email Mailer dashboard.

### Step 1: Create an Email Template

1. Go to the **Templates** tab
2. Click **+ New Template**
3. Fill in:
   - **Template Name**: e.g., "Welcome Email"
   - **Email Subject**: e.g., "Welcome to our service!"
   - **HTML Content**: Your email HTML (use {{variable}} for dynamic content)
   - **Text Content** (optional): Plain text version
   - **Description**: What this template is for
4. Click **Create Template**

**Example HTML Template:**
```html
<div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px;">
    <h1>Welcome {{firstName}}!</h1>
    <p>Thank you for joining us. We're excited to work with you.</p>
    <a href="https://yoursite.com/start" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
      Get Started
    </a>
  </div>
</div>
```

### Step 2: Import Recipients

1. Go to the **Recipients** tab
2. Click **+ Import Recipients**
3. Prepare a CSV file with the format:
   ```
   email,firstName,lastName
   john@example.com,John,Doe
   jane@example.com,Jane,Smith
   ```
4. Upload the CSV or paste the data
5. Give your list a name and description
6. Click **Import Recipients**

### Step 3: Create and Send a Campaign

1. Go to the **Campaigns** tab
2. Click **+ New Campaign**
3. Configure:
   - **Campaign Name**: e.g., "Q1 2024 Campaign"
   - **Email Template**: Select the template you created
   - **Recipient List**: Select the recipient list you imported
   - **Sender Email**: Your sending email address
   - **Sender Name**: Your company/brand name
   - **Email Provider**: Choose Nodemailer or SendGrid
4. Click **Create Campaign**
5. Click the campaign in the list and review details
6. Click **🚀 Send Campaign** to send emails to all recipients

## 🔌 Email Provider Configuration

### Nodemailer (SMTP)

For Nodemailer, you'll need SMTP credentials. Set these in your environment:

```env
# For Gmail (using app password)
NODEMAILER_HOST=smtp.gmail.com
NODEMAILER_PORT=587
NODEMAILER_USER=your-email@gmail.com
NODEMAILER_PASSWORD=your-app-password
NODEMAILER_FROM=your-email@gmail.com

# For custom SMTP server
NODEMAILER_HOST=your-smtp-server.com
NODEMAILER_PORT=587
NODEMAILER_SECURE=false
NODEMAILER_USER=your-username
NODEMAILER_PASSWORD=your-password
NODEMAILER_FROM=noreply@yourdomain.com
```

### SendGrid

Get your SendGrid API key and set it in the environment:

```env
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

## 📁 Project Structure

```
src/
├── app/
│   ├── api/mailer/           # API endpoints
│   │   ├── templates/        # Template CRUD
│   │   ├── recipients/       # Recipient import
│   │   ├── campaigns/        # Campaign management
│   │   └── send/             # Send campaign endpoint
│   └── mailer/               # Mailer dashboard page
├── components/mailer/        # UI components
│   ├── TemplateManager.tsx
│   ├── TemplateForm.tsx
│   ├── TemplateList.tsx
│   ├── TemplatePreview.tsx
│   ├── RecipientManager.tsx
│   ├── CSVUploader.tsx
│   ├── RecipientListView.tsx
│   ├── CampaignManager.tsx
│   ├── CampaignForm.tsx
│   ├── CampaignList.tsx
│   └── CampaignDetails.tsx
└── lib/email-service/        # Email service abstraction
    ├── types.ts              # TypeScript interfaces
    ├── base.ts               # Base service class
    ├── nodemailer-provider.ts
    ├── sendgrid-provider.ts
    ├── factory.ts            # Provider factory
    └── index.ts              # Exports
```

## 🗄️ Database Schema

The mailer uses these Prisma models:

- **EmailTemplate**: Email template definitions
- **EmailCampaign**: Campaign configuration and tracking
- **EmailRecipientList**: Lists of email recipients
- **EmailRecipient**: Individual recipient entries
- **EmailLog**: Detailed delivery logs for each email sent

## 🔐 Security Considerations

1. **Environment Variables**: Keep email provider credentials in `.env.local`, never in code
2. **Authorization**: All endpoints check user authentication via NextAuth
3. **User Isolation**: Users can only access their own templates, campaigns, and recipients
4. **Input Validation**: Email addresses and CSV data are validated before processing

## 🎨 UI Features

The mailer dashboard features:

- **Dark Theme**: Beautiful slate/blue gradient UI
- **Responsive Design**: Works on desktop and tablets
- **Smooth Transitions**: Elegant hover states and animations
- **Status Indicators**: Visual feedback for campaign status
- **Progress Tracking**: Real-time email sending statistics
- **Intuitive Navigation**: Tab-based interface for easy switching

## 📊 API Endpoints

All endpoints require authentication via NextAuth.

### Templates
- `GET /api/mailer/templates` - List all templates
- `POST /api/mailer/templates` - Create new template
- `GET /api/mailer/templates/[id]` - Get template details
- `PUT /api/mailer/templates/[id]` - Update template
- `DELETE /api/mailer/templates/[id]` - Delete template

### Recipients
- `GET /api/mailer/recipients` - List all recipient lists
- `POST /api/mailer/recipients` - Import new recipient list from CSV

### Campaigns
- `GET /api/mailer/campaigns` - List all campaigns
- `POST /api/mailer/campaigns` - Create new campaign

### Send
- `POST /api/mailer/send` - Send campaign to all recipients

## 🚀 Extending with More Email Providers

To add a new email provider (e.g., AWS SES, Mailgun):

1. Create a new file `src/lib/email-service/your-provider.ts`
2. Extend `BaseEmailService`:
   ```typescript
   import { BaseEmailService } from './base';
   
   export class YourProvider extends BaseEmailService {
     name = 'your-provider';
     
     async send(payload: EmailPayload): Promise<EmailSendResult> {
       // Implementation
     }
     
     validate(config: EmailConfig): EmailValidationResult {
       // Config validation
     }
     
     async testConnection(): Promise<boolean> {
       // Connection test
     }
   }
   ```
3. Add to factory in `src/lib/email-service/factory.ts`:
   ```typescript
   case 'your-provider':
     return new YourProvider(config);
   ```

## 💡 Best Practices

1. **Test Before Sending**: Always preview templates before sending campaigns
2. **Validate Lists**: Ensure recipient lists have been properly imported
3. **Monitor Delivery**: Check email logs to track delivery status
4. **Use Descriptive Names**: Give templates and campaigns clear, descriptive names
5. **Backup Recipients**: Keep backups of important recipient lists
6. **Respect Privacy**: Only send to opted-in recipients with explicit consent

## 🐛 Troubleshooting

### Emails not sending
- Check SMTP credentials are correct
- Verify sender email is authorized in your email provider
- Check email logs for specific error messages

### CSV import fails
- Ensure CSV format: `email,firstName,lastName`
- Check for valid email addresses
- Remove extra whitespace from headers

### Provider configuration error
- Verify all required configuration values are set
- Check environment variables are loaded correctly
- Test connection with provider's validation endpoint

## 📞 Support

For issues or questions about the mailer feature, check:
1. Email logs for delivery errors
2. Campaign details for specific recipient failures
3. Provider documentation for configuration help
