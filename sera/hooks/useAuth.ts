import { useCallback, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { configureGoogleSignIn } from '../config/google-signin';
import { AuthService } from '../api/auth';
import { useAuthStore } from '../store/auth-store';



export function useAuth() {
    
    const busy = useRef(false);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const signInWithGoogle = useCallback(async () => {

        if (busy.current) return null;

        busy.current = true;
        setIsSigningIn(true);
        setError(null);


        try {

            await configureGoogleSignIn();

            const { GoogleOneTapSignIn, isSuccessResponse, isCancelledResponse } =
                await import('react-native-nitro-google-signin');

                
            await GoogleOneTapSignIn.checkPlayServices();


            const response = await GoogleOneTapSignIn.presentExplicitSignIn();


            if (isCancelledResponse(response)) return null;


            if (!isSuccessResponse(response) || !response.data.idToken) {
                throw new Error('Google did not return an ID token. Please try again.');
            }

            const session = await AuthService.authenticate(response.data.idToken);

            if (!session.success || !session.data?.token || !session.data.user?.id) {
                throw new Error('Unable to complete sign-in. Please try again.');
            }

            await SecureStore.setItemAsync('authToken', session.data.token);
            useAuthStore.getState().setUser(session.data.user);

            return session;

        } catch (error) {
            setError(isAxiosError<{ message?: string }>(error)
                ? error.response?.data?.message || 'Unable to reach sign-in service. Please try again.'
                : error instanceof Error ? error.message : 'Google sign-in failed. Please try again.');
            return null;
        } finally {
            busy.current = false;
            setIsSigningIn(false);
        }
    }, []);

    return { signInWithGoogle, isSigningIn, error };
}
