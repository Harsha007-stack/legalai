const STORAGE_KEY = 'nyaya.location'

export function getStoredLocation() {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function storeLocation(location) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(location))
  } catch {
    return
  }
}

export async function detectLocation() {
  if (!window.isSecureContext) {
    throw new Error('Live location needs a secure connection (https or localhost).')
  }
  if (!('geolocation' in navigator)) {
    throw new Error('This browser does not support location access.')
  }

  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 10 * 60 * 1000,
    })
  })

  const { latitude, longitude } = position.coords
  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`)
  if (!response.ok) throw new Error('Could not look up your location right now.')

  const data = await response.json()
  const location = {
    city: data.city || data.locality || '',
    state: data.principalSubdivision || '',
    country: data.countryName || '',
    latitude,
    longitude,
  }
  if (!location.state) throw new Error('We could not identify your state from your location.')

  storeLocation(location)
  return location
}
