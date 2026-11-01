import { Link } from 'react-router-dom'
import { Gavel, Mail, MapPin, Phone } from 'lucide-react'

const address = 'IIIT Tiruchirappalli, Sethurappatti, Tamil Nadu, India'
const linkedinUrl = 'https://www.linkedin.com/school/indian-institute-of-information-technology-tiruchirappalli/'

export default function ContactFooter() {
  return (
    <footer className="contact-footer">
      <div className="contact-footer-grid">
        <div className="contact-footer-brand">
          <Link to="/" className="brand"><span className="brand-mark"><Gavel size={17} /></span><span>Nyaya<span className="brand-light">Connect</span></span></Link>
          <p>Legal information and practical tools to help you prepare for a conversation with an advocate.</p>
        </div>
        <nav className="contact-footer-column" aria-label="Footer navigation">
          <h2>Explore</h2>
          <Link to="/about">About us</Link>
          <a href="/#how-it-works">How it works</a>
          <a href="/#why-nyaya">Why NyayaConnect</a>
        </nav>
        <div className="contact-footer-column" id="contact-us">
          <h2>Contact us</h2>
          <a href="mailto:262104@iiitt.ac.in"><Mail size={15} />262104@iiitt.ac.in</a>
          <a href="tel:+917795246323"><Phone size={15} />+91 77952 46323</a>
          <a href="https://maps.google.com/?q=IIIT+Tiruchirappalli+Sethurappatti+Tamil+Nadu" target="_blank" rel="noreferrer"><MapPin size={15} />{address}</a>
        </div>
        <div className="contact-footer-column">
          <h2>Follow IIIT Tiruchirappalli</h2>
          <a href="https://www.instagram.com/iiittiruchirappalli/" target="_blank" rel="noreferrer">Instagram</a>
          <a href={linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>
        </div>
      </div>
      <div className="contact-footer-bottom">
        <span>NyayaConnect · Student project at IIIT Tiruchirappalli</span>
        <span>Preliminary legal information, not legal advice.</span>
      </div>
    </footer>
  )
}
