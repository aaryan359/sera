import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

let configuration : Promise<void> | undefined;

export async function configureGoogleSignIn(): Promise<void> {
   
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
        throw new Error('Native Google sign-in is available only on Android and iOS.');
    }

    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
        throw new Error('Google sign-in requires a Sera development build, not Expo Go.');
    }

    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';



    if (!configuration) {
        configuration = (async () => {
            // Defer native loading so importing this config does not crash unsupported builds.
            const { GoogleOneTapSignIn } = await import('react-native-nitro-google-signin').catch(() => {
                throw new Error('Native Google sign-in is missing. Rebuild Sera with Nitro installed.');
            });

            GoogleOneTapSignIn.configure({
                webClientId,
                scopes: ['email', 'profile'],
                offlineAccess: false,
                autoSelectOnSignIn: false,
            });
        })().catch(error => {
            configuration = undefined;
            throw error;
        });
    }

    await configuration;
}
