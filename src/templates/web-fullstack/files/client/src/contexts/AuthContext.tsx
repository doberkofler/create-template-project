/* eslint-disable import/no-relative-parent-imports */
/* eslint-disable react/only-export-components */
/* eslint-disable react/jsx-no-constructed-context-values */
import {createContext, useContext, useState, type ReactNode} from 'react';
import {trpc} from '../trpc.js';

type User = {
	id: string;
	name: string;
	email: string;
};

type AuthContextType = {
	user: User | null;
	token: string | null;
	isLoading: boolean;
	login: (token: string, user: User) => void;
	logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({children}: {children: ReactNode}): ReactNode => {
	const [token, setToken] = useState(localStorage.getItem('token'));
	const [loggedInUser, setLoggedInUser] = useState<User | null>(null);

	const {data: me, isLoading} = trpc.auth.me.useQuery(undefined, {
		enabled: Boolean(token),
		retry: false,
	});
	const user = me ?? loggedInUser;

	const logout = (): void => {
		localStorage.removeItem('token');
		setToken(null);
		setLoggedInUser(null);
	};

	const login = (newToken: string, newUser: User): void => {
		localStorage.setItem('token', newToken);
		setToken(newToken);
		setLoggedInUser(newUser);
	};

	return <AuthContext.Provider value={{user, token, isLoading, login, logout}}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
