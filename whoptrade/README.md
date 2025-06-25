# WhopTrade - Next.js App with Whop OAuth

This is a simple Next.js application that demonstrates how to integrate with Whop OAuth for user authentication.

## Features

- Login with Whop OAuth
- Protected dashboard page
- Simple authentication flow
- Responsive UI

## Getting Started

### Prerequisites

- Node.js 18.0 or later
- A Whop app (created in the Whop Dashboard)

### Setup

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd whoptrade
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory with the following variables (see `env.sample` for reference):
   ```
   WHOP_APP_ID=your_app_id_here
   WHOP_API_KEY=your_api_key_here
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```

   You can get your app ID and API key from the Whop Dashboard.

4. Configure your Whop app:
   - Go to the Whop Dashboard and create a new app or select an existing one.
   - In your app's OAuth settings, add `http://localhost:3000/api/oauth/callback` as a redirect URI.

### Running the App

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. When you open the app, you'll be redirected to the login page.
2. Click "Login with Whop" to initiate the OAuth flow.
3. After successful authentication, you'll be redirected to the dashboard.
4. You can log out by clicking the "Logout" button.

## Alpaca API Integration

This app integrates with the Alpaca API for stock trading functionality:

1. To use the trading features, you need valid Alpaca API keys.
2. Add the following to your `.env.local` file:
   ```
   ALPACA_API_KEY=your_alpaca_api_key_here
   ALPACA_API_SECRET=your_alpaca_api_secret_here
   ALPACA_USE_PAPER=true  # Set to false for live trading (use with caution)
   ```

### Known Limitations

- The Alpaca API v2 `/stocks/bars` endpoint does not support the `extended_hours` parameter. Our API handles this by accepting the parameter for backward compatibility but not passing it to Alpaca.
- Only real market data is used, there is no simulated data fallback.

## Deployment

To deploy the app to production:

1. Update the `NEXT_PUBLIC_BASE_URL` in your environment variables to your production URL.
2. Add your production callback URL to your Whop app's OAuth settings.
3. Deploy the app using your preferred hosting platform (Vercel, Netlify, etc.).

## License

This project is licensed under the MIT License.
