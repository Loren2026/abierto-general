import Header from './Header'

export default function PublicLayout({ children }) {
  return (
    <div className="public-layout">
      <Header />
      {children}
    </div>
  )
}
