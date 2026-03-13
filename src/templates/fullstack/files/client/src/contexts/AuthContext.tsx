import {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {trpc} from '../trpc.js';

interface User {
	id: string;
	name: string;
	email: string;
}

interface AuthContextType {
	user: User | null;
	token: string | null;
	isLoading: boolean;
	login: (token: string, user: User) => void;
	logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({children}: {children: ReactNode}) => {
	const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
	const [user, setUser] = useState<User | null>(null);

	const {data: me, isLoading} = trpc.auth.me.useQuery(undefined, {
		enabled: !!token,
		retry: false,
	});

	useEffect(() => {
		if (me) {
			setUser(me);
		} else if (!isLoading && token) {
			// Token might be invalid
			logout();
		}
	}, [me, isLoading, token]);

	const login = (newToken: string, newUser: User) => {
		localStorage.setItem('token', newToken);
		setToken(newToken);
		setUser(newUser);
	};

	const logout = () => {
		localStorage.removeItem('token');
		setToken(null);
		setUser(null);
	};

	return (
		<AuthContext.Provider value={{user, token, isLoading, login, logout}}>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
};
