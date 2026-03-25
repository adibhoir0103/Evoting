import React from 'react';
import { Link } from 'react-router-dom';

function Footer() {
    return (
        <footer role="contentinfo" className="bg-[#1e293b] text-gray-300 border-t-4 border-accent-saffron mt-auto font-sans">
            {/* Mega Directory Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Column 1: Government Profiles */}
                    <div>
                        <h4 className="text-white font-bold text-lg mb-4 pb-2 border-b border-gray-700">Govt. Profiles</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="https://presidentofindia.nic.in/" target="_blank" rel="noopener noreferrer" className="hover:text-accent-saffron transition-colors" aria-label="President of India External Link">President of India <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1"></i></a></li>
                            <li><a href="https://vicepresidentofindia.nic.in/" target="_blank" rel="noopener noreferrer" className="hover:text-accent-saffron transition-colors">Vice President of India <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1"></i></a></li>
                            <li><a href="https://pmindia.gov.in/" target="_blank" rel="noopener noreferrer" className="hover:text-accent-saffron transition-colors">Prime Minister of India <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1"></i></a></li>
                            <li><a href="https://india.gov.in/my-government/indian-parliament" target="_blank" rel="noopener noreferrer" className="hover:text-accent-saffron transition-colors">Parliament of India <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1"></i></a></li>
                            <li><a href="https://india.gov.in/my-government/whos-who/council-ministers" target="_blank" rel="noopener noreferrer" className="hover:text-accent-saffron transition-colors">Cabinet Ministers <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1"></i></a></li>
                        </ul>
                    </div>

                    {/* Column 2: Key Initiatives */}
                    <div>
                        <h4 className="text-white font-bold text-lg mb-4 pb-2 border-b border-gray-700">Digital India</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="https://mygov.in/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">MyGov Connect <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1"></i></a></li>
                            <li><a href="https://uidai.gov.in/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">UIDAI (Aadhaar) <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1"></i></a></li>
                            <li><a href="https://www.digitalindia.gov.in/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Digital India Portal <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1"></i></a></li>
                            <li><a href="https://voters.eci.gov.in/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Voter Services Portal <i className="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1"></i></a></li>
                        </ul>
                    </div>

                    {/* Column 3: Internal Services */}
                    <nav aria-label="Footer Nav Services">
                        <h4 className="text-white font-bold text-lg mb-4 pb-2 border-b border-gray-700">Bharat E-Vote Services</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/signup" className="hover:text-accent-saffron transition-colors">New Voter Registration</Link></li>
                            <li><Link to="/search-roll" className="hover:text-accent-saffron transition-colors">Search Electoral Roll</Link></li>
                            <li><Link to="/candidates" className="hover:text-accent-saffron transition-colors">Know Your Candidates</Link></li>
                            <li><Link to="/results" className="hover:text-accent-saffron transition-colors">Election Results (Real-Time)</Link></li>
                            <li><Link to="/guidelines" className="hover:text-accent-saffron transition-colors">Voter Guidelines</Link></li>
                        </ul>
                    </nav>

                    {/* Column 4: Contact & Support */}
                    <div>
                        <h4 className="text-white font-bold text-lg mb-4 pb-2 border-b border-gray-700">Support & Feedback</h4>
                        <div className="space-y-3 text-sm">
                            <p className="flex items-start gap-2">
                                <i className="fa-solid fa-location-dot mt-1 text-accent-saffron"></i>
                                <span>Election Commission of India,<br/>Nirvachan Sadan, Ashoka Road,<br/>New Delhi 110001</span>
                            </p>
                            <p className="flex items-center gap-2">
                                <i className="fa-solid fa-phone text-accent-saffron"></i>
                                Toll Free: <span className="font-bold text-white tracking-widest">1950</span>
                            </p>
                            <p className="flex items-center gap-2">
                                <i className="fa-solid fa-envelope text-accent-saffron"></i>
                                <a href="mailto:complaints@eci.gov.in" className="hover:text-white">complaints@eci.gov.in</a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sub-footer Branding */}
            <div className="bg-[#0f172a] py-8 border-t border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <img 
                            src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/220px-Emblem_of_India.svg.png" 
                            alt="Emblem of India" 
                            className="h-12 w-auto brightness-0 invert opacity-70"
                        />
                        <div>
                            <p className="text-white font-bold text-sm">Bharat E-Vote | Blockchain Electoral System</p>
                            <p className="text-xs text-gray-500 mt-1">This is a demonstration project showcasing zero-knowledge verifiable voting.</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-center md:items-end text-xs text-gray-500 space-y-2">
                        <div className="flex gap-4">
                            <a href="#" className="hover:text-white transition-colors">Accessibility Statement</a>
                            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                            <a href="#" className="hover:text-white transition-colors">Terms of Use</a>
                        </div>
                        <p>© {new Date().getFullYear()} Government of India. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
