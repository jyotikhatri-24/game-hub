import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const Login = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const { email, password } = formData;

    const onChange = (e) => {
        setFormData((prevState) => ({
            ...prevState,
            [e.target.name]: e.target.value,
        }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:5001/api/auth/login', formData);
            if (response.data) {
                localStorage.setItem('user', JSON.stringify(response.data));
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
        }
    };

    return (
        <div className="auth-page-container">
            {/* Hero Section for Split Layout */}
            <div className="auth-hero">
                <div className="hero-content">
                    <h2>Welcome to Game Hub</h2>
                    <p>The ultimate destination for scalable multiplayer gaming. Join thousands of players in real-time battles.</p>
                </div>
            </div>

            {/* Form Section */}
            <div className="auth-form-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <h1>Sign In</h1>
                        <p>Enter your credentials to access your account</p>
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={onSubmit} className="auth-form">
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
                                placeholder="Enter your password"
                                required
                            />
                        </div>
                        <button type="submit" className="auth-btn">
                            Login
                        </button>
                    </form>
                    <div className="auth-footer">
                        <p>Don't have an account? <Link to="/signup">Sign up</Link></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
