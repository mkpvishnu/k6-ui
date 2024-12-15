# k6-ui

A web-based user interface for the k6 performance testing tool. This project provides a simple and intuitive way to run k6 tests, visualize metrics in real-time, and convert cURL commands to k6 scripts.

## Prerequisites

- Node.js (v14 or later)
- k6 (https://k6.io/docs/getting-started/installation)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/k6-ui.git
cd k6-ui
```

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to `http://localhost:3000`

## Features

- Real-time metrics visualization
- Convert cURL commands to k6 scripts
- Configure virtual users and test duration
- Live console output
- Interactive charts for:
  - Virtual Users
  - Response Times
  - Requests per Second
  - Error Rate

## Development

To run in development mode with auto-reload:
```bash
npm run dev
```

## Project Structure

```
k6-ui/
├── package.json        # Project dependencies and scripts
├── src/
│   ├── index.js       # Main server file
│   ├── temp/          # Temporary test scripts
│   └── public/        # Frontend assets
│       ├── index.html # Main dashboard UI
│       └── js/
│           └── main.js # Frontend JavaScript
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/awesome-feature`)
3. Commit your changes (`git commit -m 'Add awesome feature'`)
4. Push to the branch (`git push origin feature/awesome-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details