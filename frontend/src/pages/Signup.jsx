import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const Signup = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const { username, email, password, confirmPassword } = formData;

    const onChange = (e) => {
        setFormData((prevState) => ({
            ...prevState,
            [e.target.name]: e.target.value,
        }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        console.log('[DEBUG] Signup submission started', { username, email });
        setError('');
        setIsLoading(true);

        if (password !== confirmPassword) {
            console.log('[DEBUG] Passwords do not match');
            setError('Passwords do not match');
            setIsLoading(false);
            return;
        }

        try {
            console.log('[DEBUG] Sending POST request to backend...');
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
                username,
                email,
                password
            });
            console.log('[DEBUG] Response received:', response.status);

            if (response.data) {
                localStorage.setItem('user', JSON.stringify(response.data));
                navigate('/dashboard');
            }
        } catch (err) {
            console.error('[DEBUG] Signup error caught:', err);
            const msg = err.response?.data?.message || err.message || 'Registration failed. Please try again.';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-page-container">
            {/* Hero Section for Split Layout */}
            <div className="auth-hero">
                <div className="hero-content">
                    <h2>Start Your Journey</h2>
                    <p>Create an account to track your stats, climb the leaderboard, and play with friends.</p>
                </div>
            </div>

            {/* Form Section */}
            <div className="auth-form-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <h1>Create Account</h1>
                        <p>Join Game Hub today</p>
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={onSubmit} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                value={username}
                                onChange={onChange}
                                placeholder="Choose a username"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={email}
                                onChange={onChange}
                                placeholder="Enter your email"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={password}
                                onChange={onChange}
                                placeholder="Create a password"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={confirmPassword}
                                onChange={onChange}
                                placeholder="Confirm your password"
                                required
                            />
                        </div>
                        <button type="submit" className="auth-btn" disabled={isLoading}>
                            {isLoading ? 'Signing Up...' : 'Sign Up'}
                        </button>
                    </form>
                    <div className="auth-footer">
                        <p>Already have an account? <Link to="/login">Login</Link></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
