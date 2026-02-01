import { handleAuth, handleLogin, handleCallback, handleLogout } from '@auth0/nextjs-auth0';
import { NextApiRequest, NextApiResponse } from 'next';
import { generateWalletFromAuth0Id } from '../../../utils/walletGenerator';

export default handleAuth({
    // ✅ Custom login handler that respects connection parameter
    async login(req: NextApiRequest, res: NextApiResponse) {
        try {
            // Get connection from query parameter
            const connection = req.query.connection as string;

            // Base authorization params
            const authParams: any = {
                scope: 'openid profile email',
            };

            // If connection is specified, force direct login to that provider
            if (connection) {
                authParams.connection = connection;
                // This is the key: prompt=login forces immediate redirect
                authParams.prompt = 'login';

                console.log('🔐 Direct login to:', connection);
            }

            // Call the default login handler with custom params
            return await handleLogin(req, res, {
                authorizationParams: authParams,
                returnTo: req.query.returnTo as string || '/',
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).end();
        }
    },

    // ✅ Callback handler with wallet generation
    async callback(req: NextApiRequest, res: NextApiResponse) {
        try {
            return await handleCallback(req, res, {
                afterCallback: async (req: any, res: any, session: any) => {
                    try {
                        console.log('✅ User authenticated:', session.user.sub);

                        // Generate deterministic wallet from Auth0 user ID
                        const { address } = generateWalletFromAuth0Id(session.user.sub);

                        // Add wallet to session
                        session.user.walletAddress = address;

                        console.log('✅ Wallet generated:', address);
                        console.log('🔗 PolygonScan:', `https://polygonscan.com/address/${address}`);

                        return session;
                    } catch (error) {
                        console.error('❌ Error in callback:', error);
                        return session;
                    }
                },
            });
        } catch (error: any) {
            console.error('Callback error:', error);
            res.status(error.status || 500).end(error);
        }
    },

    // ✅ Logout handler
    logout: handleLogout({
        returnTo: '/',
    }),

    // ✅ Signup handler (shows signup screen)
    async signup(req: NextApiRequest, res: NextApiResponse) {
        try {
            return await handleLogin(req, res, {
                authorizationParams: {
                    screen_hint: 'signup',
                },
                returnTo: '/',
            });
        } catch (error) {
            console.error('Signup error:', error);
            res.status(500).end();
        }
    },
});
