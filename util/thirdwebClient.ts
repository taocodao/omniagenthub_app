import { createThirdwebClient } from 'thirdweb';

// Create thirdweb client
export const thirdwebClient = createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

// Export for use in components
export { thirdwebClient as client };
