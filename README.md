# Fixify - Mobile Repair Service App

A mobile application that connects customers with technicians for device repair services. Built with React Native and Expo.

## Features

- User authentication (Customer/Technician)
- Real-time chat between customers and technicians
- Repair request management
- Progress tracking
- Payment processing
- Push notifications
- Location-based service matching

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Expo CLI
- Firebase account

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/fixify-app.git
cd fixify-app
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory and add your Firebase configuration:
```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_app_id
```

4. Start the development server:
```bash
npx expo start
```

## Running the App

- Press `a` to open on Android emulator
- Press `i` to open on iOS simulator
- Scan the QR code with Expo Go app on your physical device

## Project Structure

```
fixify-app/
├── app/                    # Main application screens
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Tab navigation screens
│   └── screens/           # Other screens
├── components/            # Reusable components
├── config/               # Configuration files
├── assets/              # Static assets
└── constants/           # Constants and theme
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
