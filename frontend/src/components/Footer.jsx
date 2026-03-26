import React from 'react';
import { Link } from 'react-router-dom';

function Footer() {
    return (
        <footer role="contentinfo" className="w-full font-sans mt-auto">
            {/* 1. Logos Strip (White Background) */}
            <div className="bg-white py-6 border-b-4 border-accent-saffron shadow-inner">
                <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center md:justify-around items-center gap-8">
                    <a href="https://eci.gov.in" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center group">
                        <img src="https://s2.googleusercontent.com/s2/favicons?domain=eci.gov.in&sz=256" alt="Election Commission of India Logo" className="h-10 w-10 object-contain transition-transform group-hover:scale-105" />
                        <span className="text-[10px] font-bold text-[#0b2b54] mt-2 hidden md:block">Election Commission</span>
                    </a>
                    <a href="https://digitalindia.gov.in" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center group">
                        <img src="https://s2.googleusercontent.com/s2/favicons?domain=digitalindia.gov.in&sz=256" alt="Digital India Logo" className="h-10 w-10 object-contain transition-transform group-hover:scale-105" />
                    </a>
                    <a href="https://mygov.in" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center group">
                        <img src="https://s2.googleusercontent.com/s2/favicons?domain=mygov.in&sz=256" alt="MyGov Logo" className="h-10 w-10 object-contain transition-transform group-hover:scale-105" />
                    </a>
                    <a href="https://www.nic.in" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center group">
                        <img src="https://s2.googleusercontent.com/s2/favicons?domain=nic.in&sz=256" alt="NIC Logo" className="h-10 w-10 object-contain transition-transform group-hover:scale-105" />
                    </a>
                </div>
            </div>

            {/* 2. Main Footer Data (Dark Blue - WCAG AA Compliant Contrast) */}
            <div className="bg-[#0b2b54] text-white py-10">
                <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Left: Branding & Info */}
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                        <a href="https://india.gov.in" target="_blank" rel="noopener noreferrer" className="shrink-0 bg-white p-3 rounded-lg flex items-center justify-center">
                            <img 
                                src="https://s2.googleusercontent.com/s2/favicons?domain=india.gov.in&sz=256" 
                                alt="National Emblem of India" 
                                className="h-16 w-16 object-contain"
                            />
                        </a>
                        <div className="text-center sm:text-left">
                            <h3 className="text-xl text-white font-bold uppercase tracking-wider mb-2">Bharat E-Vote Core</h3>
                            <p className="text-sm text-gray-300 leading-relaxed max-w-sm">
                                This site is designed, developed, hosted and maintained by the Election Commission of India (ECI), 
                                Ministry of Law & Justice, Government of India.
                            </p>
                        </div>
                    </div>

                    {/* Right: Social & Version */}
                    <div className="flex flex-col md:items-end space-y-4">
                        <div className="text-center md:text-right">
                            <h4 className="text-sm font-bold uppercase tracking-widest mb-3 text-white">ECI on Social Media</h4>
                            <div className="flex justify-center md:justify-end gap-3 items-center">
                                <a href="https://facebook.com/ECI" target="_blank" rel="noopener noreferrer" aria-label="Follow ECI on Facebook" className="w-8 h-8 rounded-full bg-white text-[#0b2b54] flex items-center justify-center hover:bg-gray-200 focus:ring-2 focus:ring-accent-saffron transition-colors"><i className="fa-brands fa-facebook-f"></i></a>
                                <a href="https://twitter.com/ECISVEEP" target="_blank" rel="noopener noreferrer" aria-label="Follow ECI on Twitter" className="w-8 h-8 rounded-full bg-white text-[#0b2b54] flex items-center justify-center hover:bg-gray-200 focus:ring-2 focus:ring-accent-saffron transition-colors"><i className="fa-brands fa-twitter"></i></a>
                                <a href="https://linkedin.com/company/election-commission-of-india" target="_blank" rel="noopener noreferrer" aria-label="Follow ECI on LinkedIn" className="w-8 h-8 rounded-full bg-white text-[#0b2b54] flex items-center justify-center hover:bg-gray-200 focus:ring-2 focus:ring-accent-saffron transition-colors"><i className="fa-brands fa-linkedin-in"></i></a>
                                <a href="https://youtube.com/eci" target="_blank" rel="noopener noreferrer" aria-label="Subscribe to ECI on YouTube" className="w-8 h-8 rounded-full bg-white text-[#0b2b54] flex items-center justify-center hover:bg-gray-200 focus:ring-2 focus:ring-accent-saffron transition-colors"><i className="fa-brands fa-youtube"></i></a>
                            </div>
                        </div>

                        <div className="text-right text-xs text-gray-300 pt-2">
                            <p>Latest Version - 3.1.4</p>
                            <p>Released date - 26-March-2026</p>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 mt-8 text-center text-xs text-gray-300">
                    <p>Bharat E-Vote website is best viewed on desktop & laptop using latest version of Chrome (ver 89+), Firefox (ver 87+), Safari (ver 14+), MS Edge (ver 89+) or an equivalent browser with a screen resolution of 1024×768 or higher.</p>
                </div>
            </div>

            {/* 3. Sub Footer Links (Darkest Blue) */}
            <div className="bg-[#05152c] text-white py-6">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-xs font-semibold mb-4 text-gray-200">
                        Designed & developed by Election Commission of India, Govt. of India and hosted on Meghraj cloud
                    </p>
                    
                    <div className="flex flex-wrap justify-center text-[11px] text-gray-400">
                        <Link to="/" className="hover:text-white transition px-2">About Us</Link> <span className="text-gray-600">|</span>
                        <Link to="/help" className="hover:text-white transition px-2">Help</Link> <span className="text-gray-600">|</span>
                        <a href="https://voters.eci.gov.in/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition px-2 font-bold text-accent-saffron">Voter Services Portal <i className="fa-solid fa-external-link-alt text-[8px] ml-0.5"></i></a> <span className="text-gray-600">|</span>
                        <Link to="/vote" className="hover:text-white transition px-2 font-bold text-accent-saffron">Cast Vote Online</Link> <span className="text-gray-600">|</span>
                        <Link to="/guidelines" className="hover:text-white transition px-2 focus:outline-none focus:underline" aria-label="Disclaimer Policy">Disclaimer</Link> <span className="text-gray-600">|</span>
                        <Link to="/guidelines" className="hover:text-white transition px-2 focus:outline-none focus:underline" aria-label="Copyright Guidelines">Copyright Policy</Link> <span className="text-gray-600">|</span>
                        <Link to="/guidelines" className="hover:text-white transition px-2 focus:outline-none focus:underline" aria-label="External Hyperlink Policies">Hyperlink Policy</Link> <span className="text-gray-600">|</span>
                        <Link to="/help" className="hover:text-white transition px-2 focus:outline-none focus:underline" aria-label="Submit Feedback to Webmaster">Feedback</Link> <span className="text-gray-600">|</span>
                        <Link to="/guidelines" className="hover:text-white transition px-2 focus:outline-none focus:underline" aria-label="Portal Terms and Conditions">Terms & Conditions</Link> <span className="text-gray-600">|</span>
                        <Link to="/guidelines" className="hover:text-white transition px-2 focus:outline-none focus:underline" aria-label="Content Archival Information">Content Archival Policy</Link> <span className="text-gray-600">|</span>
                        <Link to="/guidelines" className="hover:text-white transition px-2 focus:outline-none focus:underline" aria-label="Strict Privacy Directives">Privacy Policy</Link> <span className="text-gray-600">|</span>
                        <Link to="/guidelines" className="hover:text-white transition px-2 focus:outline-none focus:underline" aria-label="Operations Monitoring Architecture">Website Monitoring Plan</Link> <span className="text-gray-600">|</span>
                        <Link to="/guidelines" className="hover:text-white transition px-2 focus:outline-none focus:underline" aria-label="Cybersecurity Protocol Statement">Security Policy</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
