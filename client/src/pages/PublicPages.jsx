import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, FileText, Gavel, Menu, MessageCircle, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useDemo } from '../context/useDemo'
import { Button, Card, Field } from '../components/UI'
import ContactFooter from '../components/ContactFooter'

function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const sectionHref = (id) => pathname === '/' ? `#${id}` : `/#${id}`
  return (
    <header className="public-header">
      <Link to="/" className="brand"><span className="brand-mark"><Gavel size={19} /></span><span>Nyaya<span className="brand-light">Connect</span></span></Link>
      <button className="icon-button public-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      <nav className={`public-nav ${menuOpen ? 'public-nav-open' : ''}`} aria-label="Public navigation">
        <a href={sectionHref('how-it-works')} onClick={() => setMenuOpen(false)}>How it works</a><a href={sectionHref('why-nyaya')} onClick={() => setMenuOpen(false)}>Why NyayaConnect</a><Link to="/about" onClick={() => setMenuOpen(false)}>About us</Link><Link to="/login" onClick={() => setMenuOpen(false)}>Log in</Link><Link className="button button-primary public-cta" to="/register" onClick={() => setMenuOpen(false)}>Create an account</Link>
      </nav>
    </header>
  )
}

export function LandingPage() {
  return (
    <div className="public-page">
      <PublicHeader />
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="kicker-line" /> A clearer first step</div>
            <h1>Legal questions are hard.<br /><span>Getting started shouldn’t be.</span></h1>
            <p className="hero-description">Make sense of your concern, organize the details, and explore advocates who may be relevant to your needs — at your own pace.</p>
            <div className="hero-actions"><Link to="/register" className="button button-primary button-large">Get legal guidance</Link><a className="text-link" href="#how-it-works">See how it works</a></div>
            <div className="hero-assurance"><ShieldCheck size={17} /><span>Your information. Your choices. Your next step.</span></div>
          </div>
          <div className="hero-visual" aria-label="Illustration of the NyayaConnect process">
            <div className="visual-topline"><span>YOUR NEXT STEP</span><span className="visual-status"><i /> IN YOUR CONTROL</span></div>
            <div className="visual-title">A little clarity<br />can change a lot.</div>
            <div className="visual-steps">
              <div className="visual-step visual-step-done"><span className="visual-step-icon"><MessageCircle size={17} /></span><div><strong>Understand the issue</strong><small>Put the situation into words</small></div><Check size={16} /></div>
              <div className="visual-connector" />
              <div className="visual-step visual-step-current"><span className="visual-step-icon"><FileText size={17} /></span><div><strong>Prepare with confidence</strong><small>Organize facts and documents</small></div></div>
              <div className="visual-connector" />
              <div className="visual-step visual-step-next"><span className="visual-step-icon"><Gavel size={17} /></span><div><strong>Choose who to talk to</strong><small>You decide whether to connect</small></div></div>
            </div>
            <div className="visual-footer"><span>Preliminary information, not legal advice.</span></div>
          </div>
        </section>
        <section className="trust-strip"><span>BUILT AROUND YOUR CHOICES</span><div><ShieldCheck size={17} /><span>Private by design</span></div><div><Sparkles size={17} /><span>AI, with clear limits</span></div><div><Gavel size={17} /><span>You choose your advocate</span></div></section>
        <section id="how-it-works" className="section-block">
          <div className="section-heading"><span className="eyebrow">A SIMPLE PLACE TO START</span><h2>From uncertainty to a<br />more informed next step.</h2><p>NyayaConnect helps you prepare for a conversation — it never makes the decision for you.</p></div>
          <div className="process-grid">
            {[{ icon: MessageCircle, title: 'Understand', body: 'Describe what happened in everyday language. Get help organizing the facts and identifying what is still unclear.' }, { icon: FileText, title: 'Prepare', body: 'Build a practical checklist and, when available, an editable first draft based on details you review.' }, { icon: Gavel, title: 'Connect', body: 'Explore advocate profiles and choose whether you want to send a consultation request.' }].map(({ icon: Icon, title, body }) => <Card className="process-card" key={title}><div className="process-card-top"><Icon size={20} /></div><h3>{title}</h3><p>{body}</p></Card>)}
          </div>
        </section>
        <section id="why-nyaya" className="why-section"><div className="why-mark"><span className="brand-mark"><Gavel size={22} /></span><span className="eyebrow">A MORE HUMAN START</span></div><div className="why-copy"><h2>Clarity first.<br />No pressure to act.</h2><p>Legal situations can feel overwhelming. Start by laying out what you know, see possible next steps, and decide what feels right for you.</p><div className="why-points"><span><Check size={16} /> No automatic messages or filings</span><span><Check size={16} /> Review and edit AI-generated content</span><span><Check size={16} /> Choose what you share and with whom</span></div><Link className="text-link" to="/register">Take your first step</Link></div></section>
        <section className="disclaimer-band"><ShieldCheck size={20} /><p><strong>A note on legal information.</strong> NyayaConnect provides preliminary information and tools to organize your concerns. It is not a law firm and does not replace advice from a qualified advocate.</p></section>
      </main>
      <ContactFooter />
    </div>
  )
}

export function AboutPage() {
  const team = [
    { name: 'Harshavardhan S. Kale', role: 'Frontend and backend developer', photo: '/team/harshavardhan-kale.png', alt: 'Harshavardhan S. Kale', color: 'violet' },
    { name: 'Database & integration', role: 'Database developer and integrator', photo: '/team/database-integrator.png', alt: 'Database developer and integrator', color: 'orange' },
    { name: 'Sanjeev Reddy', role: 'Generative AI developer and integrator', photo: '/team/sanjeev-reddy.png', alt: 'Sanjeev Reddy', color: 'blue' },
  ]

  return (
    <div className="public-page">
      <PublicHeader />
      <main className="about-page">
        <section className="about-intro">
          <span className="eyebrow">ABOUT NYAYACONNECT</span>
          <h1>A clearer place to begin when a legal issue feels difficult.</h1>
          <p>NyayaConnect is a student-built project from IIIT Tiruchirappalli. It helps people organize what happened, understand possible next steps, and prepare for a conversation with an advocate.</p>
        </section>
        <section className="about-story">
          <div>
            <span className="eyebrow">WHAT WE’RE BUILDING</span>
            <h2>Useful tools, with people in control.</h2>
          </div>
          <p>The platform brings together a legal information assistant, document organization, and advocate discovery. AI-generated content is a starting point to review—not a legal decision, filing, or replacement for advice from a qualified advocate. People decide what information to share and whether to contact an advocate.</p>
        </section>
        <section className="about-team">
          <div className="about-team-inner">
            <div className="about-team-heading">
              <span className="eyebrow">THE TEAM</span>
              <h2>Meet the people behind NyayaConnect.</h2>
              <p>Product, data, and generative AI—built together at IIIT Tiruchirappalli.</p>
            </div>
            <div className="team-grid">
              {team.map((member) => (
                <article className="team-card" key={member.name}>
                  <div className={`team-photo-stage team-photo-${member.color}`}>
                    <img className="team-photo" src={member.photo} alt={member.alt} loading="lazy" decoding="async" />
                  </div>
                  <div className="team-card-copy"><h3>{member.name}</h3><p>{member.role}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export function LoginPage() {
  const [role, setRole] = useState('citizen')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, authenticate, isSupabaseConfigured } = useDemo()
  const navigate = useNavigate()
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!email.includes('@') || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      if (isSupabaseConfigured) {
        const profile = await authenticate({ email, password })
        navigate(profile.role === 'advocate' ? '/advocate' : '/app')
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 450))
        const name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
        signIn({ name: name || (role === 'citizen' ? 'Demo Citizen' : 'Demo Advocate'), email, role })
        navigate(role === 'advocate' ? '/advocate' : '/app')
      }
    } catch (submitError) {
      setError(submitError.message || 'Could not sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="auth-page"><PublicHeader /><main className="auth-main"><section className="auth-aside"><span className="eyebrow">WELCOME BACK</span><h1>A steadier way to take your next step.</h1><p>Pick up where you left off. Your workspace is ready when you are.</p><div className="auth-aside-note"><ShieldCheck size={18} /><span>Private by design. You choose what to share.</span></div></section><Card className="auth-card"><span className="eyebrow">SIGN IN</span><h2>Welcome back</h2><p className="auth-subtitle">{isSupabaseConfigured ? 'Sign in with your NyayaConnect account.' : 'Use any email and password to enter the interactive demo.'}</p><form onSubmit={submit} noValidate>
      <div className="role-selector" aria-label="Choose demo account type"><button type="button" aria-pressed={role === 'citizen'} className={role === 'citizen' ? 'role-option role-selected' : 'role-option'} onClick={() => setRole('citizen')}><span>Citizen</span><small>Explore legal support</small></button><button type="button" aria-pressed={role === 'advocate'} className={role === 'advocate' ? 'role-option role-selected' : 'role-option'} onClick={() => setRole('advocate')}><span>Advocate</span><small>View request inbox</small></button></div>
      <Field label="Email address" id="login-email"><input id="login-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
      <Field label="Password" id="login-password" hint={isSupabaseConfigured ? undefined : 'Demo only — password is not saved.'}><input id="login-password" type="password" autoComplete="current-password" placeholder="At least 6 characters" value={password} onChange={(event) => setPassword(event.target.value)} required /></Field>
      {error && <p className="form-error" role="alert">{error}</p>}<Button type="submit" className="button-block" disabled={loading}>{loading ? 'Opening demo…' : 'Continue'} <ArrowRight size={16} /></Button>
      </form><p className="auth-bottom">New to NyayaConnect? <Link to="/register">{isSupabaseConfigured ? 'Create an account' : 'Create a demo account'}</Link></p>{!isSupabaseConfigured && <p className="demo-caption">This is a frontend prototype. No real account is created.</p>}</Card></main></div>
  )
}

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'citizen' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const { signIn, register, isSupabaseConfigured } = useDemo()
  const navigate = useNavigate()
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (form.name.trim().length < 2) nextErrors.name = 'Enter your name.'
    if (!form.email.includes('@')) nextErrors.email = 'Enter a valid email address.'
    if (form.password.length < 6) nextErrors.password = 'Use at least 6 characters.'
    if (form.password !== form.confirm) nextErrors.confirm = 'Passwords do not match.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setLoading(true)
    setNotice('')
    try {
      if (isSupabaseConfigured) {
        const result = await register({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role })
        if (result.needsEmailConfirmation) {
          setNotice('Account created. Check your email to confirm the address, then sign in.')
          return
        }
        navigate(result.profile.role === 'advocate' ? '/advocate' : '/app')
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 450))
        signIn({ name: form.name.trim(), email: form.email.trim(), role: form.role })
        navigate(form.role === 'advocate' ? '/advocate' : '/app')
      }
    } catch (submitError) {
      setErrors((current) => ({ ...current, submit: submitError.message || 'Could not create an account. Please try again.' }))
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="auth-page"><PublicHeader /><main className="auth-main auth-main-register"><section className="auth-aside"><span className="eyebrow">START HERE</span><h1>A little clarity can make the next step easier.</h1><p>Set up a workspace to explore the citizen or advocate experience.</p><div className="auth-aside-note"><ShieldCheck size={18} /><span>{isSupabaseConfigured ? 'Your account is stored securely with Supabase.' : 'No real profile is created in this prototype.'}</span></div></section><Card className="auth-card"><span className="eyebrow">CREATE AN ACCOUNT</span><h2>Get started</h2><p className="auth-subtitle">{isSupabaseConfigured ? 'Choose your account type and create your profile.' : 'Choose the demo workspace that fits you.'}</p><form onSubmit={submit} noValidate>
      <div className="role-selector" aria-label="Select your role"><button type="button" aria-pressed={form.role === 'citizen'} className={form.role === 'citizen' ? 'role-option role-selected' : 'role-option'} onClick={() => setField('role', 'citizen')}><span>Citizen</span><small>Looking for guidance</small></button><button type="button" aria-pressed={form.role === 'advocate'} className={form.role === 'advocate' ? 'role-option role-selected' : 'role-option'} onClick={() => setField('role', 'advocate')}><span>Advocate</span><small>Receiving requests</small></button></div>
      <Field label="Full name" id="register-name" error={errors.name}><input id="register-name" autoComplete="name" placeholder="Your name" value={form.name} onChange={(event) => setField('name', event.target.value)} /></Field>
      <Field label="Email address" id="register-email" error={errors.email}><input id="register-email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => setField('email', event.target.value)} /></Field>
      <div className="form-two-col"><Field label="Password" id="register-password" error={errors.password}><input id="register-password" type="password" autoComplete="new-password" placeholder="6+ characters" value={form.password} onChange={(event) => setField('password', event.target.value)} /></Field><Field label="Confirm password" id="register-confirm" error={errors.confirm}><input id="register-confirm" type="password" autoComplete="new-password" placeholder="Repeat password" value={form.confirm} onChange={(event) => setField('confirm', event.target.value)} /></Field></div>
      {errors.submit && <p className="form-error" role="alert">{errors.submit}</p>}{notice && <p className="save-success" role="status">{notice}</p>}<Button type="submit" className="button-block" disabled={loading}>{loading ? (isSupabaseConfigured ? 'Creating account…' : 'Creating demo…') : (isSupabaseConfigured ? 'Create account' : 'Create demo account')} <ArrowRight size={16} /></Button>
      </form><p className="auth-bottom">Already have an account? <Link to="/login">{isSupabaseConfigured ? 'Log in' : 'Log in to demo'}</Link></p>{!isSupabaseConfigured && <p className="demo-caption">Passwords are used only for this form validation and are not saved.</p>}</Card></main></div>
  )
}
