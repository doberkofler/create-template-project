/* eslint-disable import/no-relative-parent-imports */
/* eslint-disable react/only-export-components */
/* eslint-disable react/jsx-no-constructed-context-values */
/* eslint-disable typescript/no-unnecessary-condition */
import {createContext, useContext, useState, useEffect, type ReactNode} from 'react';
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
	const [user, setUser] = useState<User | null>(null);

	const {data: me, isLoading} = trpc.auth.me.useQuery(undefined, {
		enabled: Boolean(token),
		retry: false,
	});

	const logout = (): void => {
		localStorage.removeItem('token');
		setToken(null);
		setUser(null);
	};

	useEffect(() => {
		if (me !== undefined && me !== null) {
			setUser(me);
		} else if (!isLoading && token !== null && token !== '') {
			// Token might be invalid
			logout();
		}
	}, [me, isLoading, token]);

	const login = (newToken: string, newUser: User): void => {
		localStorage.setItem('token', newToken);
		setToken(newToken);
		setUser(newUser);
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
