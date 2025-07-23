# Web3Auth Sign Up & Sign In Guide

## 🌐 Overview

The Web3Auth integration now supports both **account creation (sign up)** and **authentication (sign in)** modes. Users can choose whether they want to create a new account or sign in to an existing one.

## 🔄 How It Works

### **Sign Up Mode**
- **Purpose**: Create a new Web3Auth account
- **Use Case**: First-time users or users who don't have an account yet
- **Process**: 
  1. User enters email and password
  2. Web3Auth creates a new account
  3. A new wallet is generated for the user
  4. User proceeds to organization setup

### **Sign In Mode**
- **Purpose**: Authenticate with existing Web3Auth account
- **Use Case**: Returning users who already have an account
- **Process**:
  1. User enters email and password
  2. Web3Auth authenticates existing account
  3. Existing wallet is restored
  4. User proceeds to organization setup

## 🎯 User Interface

### **Step 3: Web3Auth Account**
The interface includes:

1. **Mode Toggle Buttons**:
   - **Sign In**: For existing users
   - **Sign Up**: For new users

2. **Dynamic Messaging**:
   - Sign Up: "Create a new Web3Auth account with your email and password..."
   - Sign In: "Sign in to your existing Web3Auth account or create a new one..."

3. **Dynamic Placeholders**:
   - Sign Up: "Create a password"
   - Sign In: "Enter your password"

4. **Dynamic Button Text**:
   - Sign Up: "Create Account" / "Creating Account..."
   - Sign In: "Sign In" / "Signing In..."

## 🔧 Technical Implementation

### **Web3AuthService Methods**

```typescript
// Connect with email/password (supports both sign up and sign in)
static async connectWithEmailPassword(
  email: string, 
  password: string, 
  isSignUp: boolean = false
): Promise<any>

// Check if account exists (for future use)
static async checkAccountExists(email: string): Promise<boolean>
```

### **Return Object**
```typescript
{
  address: string,           // Wallet address
  provider: any,            // Web3Auth provider
  walletClient: any,        // Viem wallet client
  account: any,             // Viem account
  privateKey: string,       // Private key
  isNewAccount: boolean     // Whether this is a new account
}
```

## 🧪 Testing

### **Test File: `test-web3auth-email.html`**

1. **Environment Check**: Verifies Web3Auth configuration
2. **Mode Toggle**: Switch between Sign In and Sign Up modes
3. **Real-time Testing**: Test both authentication modes
4. **Results Display**: Shows detailed information about the authentication

### **Testing Steps**
1. Open `test-web3auth-email.html` in your browser
2. Choose "Sign In" or "Sign Up" mode
3. Enter email and password
4. Click the test button
5. Review the results

## 📋 Configuration

### **Environment Variables**
```bash
VITE_WEB3_AUTH_CLIENT_ID=your_web3auth_client_id
VITE_WEB3_AUTH_NETWORK=sapphire_devnet
```

### **Network Configuration**
- **Chain ID**: `0xaa36a7` (Sepolia testnet)
- **RPC URL**: `https://rpc.ankr.com/eth_sepolia`
- **Purpose**: Development and testing

## 🎯 Benefits

### **For Users**
- ✅ **Flexible Authentication**: Choose between sign up and sign in
- ✅ **Familiar Experience**: Email/password authentication
- ✅ **Secure Wallets**: Web3Auth manages private keys securely
- ✅ **Cross-device Access**: Same account across devices

### **For Developers**
- ✅ **Unified Interface**: Single component handles both modes
- ✅ **Clear Feedback**: Dynamic messaging based on mode
- ✅ **Error Handling**: Comprehensive error messages
- ✅ **Testing Support**: Dedicated test file for verification

## 🚀 Usage Flow

### **New User (Sign Up)**
1. User clicks "Sign Up" button
2. Enters email and creates password
3. Clicks "Create Account"
4. Web3Auth creates new account and wallet
5. Proceeds to organization setup

### **Existing User (Sign In)**
1. User clicks "Sign In" button
2. Enters email and password
3. Clicks "Sign In"
4. Web3Auth authenticates existing account
5. Proceeds to organization setup

## 🔍 Troubleshooting

### **Common Issues**
1. **Invalid Credentials**: Check email/password combination
2. **Network Issues**: Verify Web3Auth network configuration
3. **Environment Variables**: Ensure all required variables are set
4. **Browser Compatibility**: Test in modern browsers

### **Debug Information**
- Check browser console for detailed error messages
- Use the test file to verify configuration
- Review Web3Auth dashboard for account status

## 📚 Next Steps

1. **Test the integration** with both sign up and sign in modes
2. **Configure Web3Auth** in your dashboard
3. **Customize messaging** for your specific use case
4. **Add additional validation** if needed
5. **Implement account recovery** features

The Web3Auth integration now provides a complete authentication solution that supports both new and existing users! 🎉 