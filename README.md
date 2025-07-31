# Decentralized Voting System

A modern, blockchain-based voting application built with Next.js and the Xian blockchain.

## 🚀 Features

- **Create Polls**: Users can create new polls with multiple voting options
- **Vote Securely**: Cast votes using blockchain technology for transparency
- **Real-time Results**: See live voting results with percentage breakdowns
- **User-friendly Interface**: Clean, modern UI with Bulma CSS framework
- **Wallet Integration**: Seamless integration with Xian wallet extension

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18
- **Styling**: Bulma CSS Framework
- **State Management**: Zustand
- **Blockchain**: Xian Network
- **Wallet**: Xian Wallet Extension

## 📋 Prerequisites

- Node.js 18+
- Xian Wallet Extension installed in your browser
- Access to Xian testnet

## 🚀 Getting Started

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Run Development Server**

   ```bash
   npm run dev
   ```

3. **Open Browser**
   Navigate to `http://localhost:3000`

4. **Connect Wallet**
   - Install the Xian Wallet Extension
   - Connect your wallet to the dapp
   - Ensure you have some test tokens

## 🎯 How to Use

### Creating a Poll

1. Click "Create New Poll" button
2. Enter a poll title
3. Add voting options (minimum 2)
4. Click "Create Poll" to submit to blockchain

### Voting

1. Browse available polls
2. Click "Vote" on your preferred option
3. Confirm transaction in your wallet
4. See real-time results update

### Viewing Results

- Results are displayed in real-time
- Progress bars show vote percentages
- Total vote counts are visible
- Your voted option is highlighted

## 🔧 Smart Contract Integration

The dapp integrates with Xian smart contracts for:

- `create_poll`: Creates new polls on the blockchain
- `vote`: Submits votes securely
- `get_polls`: Retrieves poll data
- `get_votes`: Gets voting results

## 🎨 UI Components

- **Poll Cards**: Display poll information and voting options
- **Progress Bars**: Visual representation of vote percentages
- **Vote Buttons**: Interactive voting interface
- **Create Form**: Modal for creating new polls

## 🔒 Security Features

- **Blockchain Verification**: All votes are recorded on-chain
- **One Vote Per User**: Prevents duplicate voting
- **Transparent Results**: All data is publicly verifiable
- **Wallet Authentication**: Secure user identification

## 🚀 Future Enhancements

- [ ] Token-weighted voting
- [ ] Time-locked polls
- [ ] Delegated voting
- [ ] Mobile app
- [ ] Advanced analytics
- [ ] Multi-language support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please open an issue in the GitHub repository or contact the development team.
# xipoll
