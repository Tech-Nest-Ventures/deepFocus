import fs from 'fs'
import path from 'path'
import plist from 'simple-plist'

// Helper to read the Info.plist file
async function readPlistFile(filePath: string) {
  return new Promise<MacosAppInfo>((resolve, reject) => {
    plist.readFile<MacosAppInfo>(filePath, (error, data) => {
      if (error || !data) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
}

// Helper to read and convert .icns file to base64 PNG
async function readIcnsAsImageUri(file: string) {
  try {
    const buf = await fs.promises.readFile(file)
    if (!buf) return ''

    const totalSize = buf.readInt32BE(4) - 8
    const icons = []
    let start = 0
    const buffer = buf.subarray(8)

    while (start < totalSize) {
      const type = buffer.subarray(start, start + 4).toString()
      const size = buffer.readInt32BE(start + 4)
      const data = buffer.subarray(start + 8, start + size)
      icons.push({ type, size, data })
      start += size
    }

    icons.sort((a, b) => b.size - a.size)
    const imageData = icons[0]?.data
    if (imageData?.subarray(1, 4).toString() === 'PNG') {
      return 'data:image/png;base64,' + imageData.toString('base64')
    }
    return '' // No valid image data
  } catch (error) {
    console.error(`Error reading .icns file: ${error.message}`)
    return '' // Return an empty string or fallback icon
  }
}

// Updated getInstalledApps function
export async function getInstalledApps(): Promise<
  { name: string; path: string; icon: string | null }[]
> {
  const dir = '/Applications'
  const appPaths = await fs.promises.readdir(dir)

  const appPromises = appPaths.map(async (appPath) => {
    const fullAppPath = path.join(dir, appPath)
    const plistPath = path.join(fullAppPath, 'Contents/Info.plist')

    if (fs.existsSync(plistPath)) {
      const info = await readPlistFile(plistPath)
      const iconPath = path.join(fullAppPath, 'Contents/Resources', info.CFBundleIconFile)

      let icon = null
      if (fs.existsSync(iconPath)) {
        icon = await readIcnsAsImageUri(iconPath)
      } else {
        console.warn(`Icon not found for ${info.CFBundleName}, using fallback`)
        // Provide a default/fallback icon if iconPath doesn't exist
        icon =
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAABIVJREFUWIXNVztvJEUQ/qqnex67M2ffYowgJrqQE+h+AhIJKSHB/Y/7D0hkCIkACZDQkR0BOiEkogsvICFw5jut117Ps98EM9Me27uLMRioYNU7U931VdVX1TXAfyz0D+nsEv+XD1dKvR9F0WMi+oCI3gLwJoDoFsbX3vtXAF46577inP+wU/v58+fcWvu59975OxDn3NPj4+P51mhYaz+7C8NXQHw/jXxYNE3zKMuyX8dnylisqhpNpyC1gfceB3s5Ts7rrREkIiyKGZbrCkSEWESYJQmKNEGeJUHPGPOhEOLHKQAyxnwRRdGno/Gzurlhmm8mszgOIKy133DOPwHg+QV4ejQqr6oajAjLdRUOSGOBPEtgrIPUGtpYON8TnBFB8AiJEOARQ9VKdEqHqLxxb46ykwEAEb03OB8AMCJ6ZzRWdxJFlsJ5DyJCkaWIeV8Eq3JzCpSxaKXGwV6OWRKDRxHKtgMGkI2UQZeIDgEwAI4PSIiIslFBGxeUiywFZ4RVWeNgL0fEGLJEIBEcEbE+pN5BahO8XpU19ucZiixF1XY9QG2nAPZGuyEFAOJRwbkeQBYLxDzCqqxDuBfFHFJrlI2Ecf2hnEVIY477eV9hznuc1S0WxRxpLAAA3l/rRzT+EADhvQ8xer0uN4b578rhXjGNQgJAs02KI/mMdViuK6zKekwlOqXhnEfZSqzKGquyRtlKOOfRKQOgT/uqrLFcVzC2j+a28t0IYAx3pzSc90hjAan7/MacY1XVaKWCsQ7GOrRSYVXVgahSa6SxgPM+7NuQgu0ARlGmz3EiePCu6npvr4F2HrVUA3CDRPT00sZe070xAOf78EXEAuGUMVv19fDOOBsqxG3x/EYA/g3ZCYBN6pyzPr8x51v1xfCOswh2iB6j3ePETgAXpDJI4/7wPE3A2PVDGSPMk76VpDGH1GYAtXuM2AlgJFIrNRIhAphF3jcYxgiMEdJYYJHPAz8SIdBKHda75P/diMqmg3Mey3WF12c9KO/7/nBWtVieV1ieVzirWnRKh2b1+qzEcl3BOY+qlZfOvCpTAKFeaCBOqzSUsdifZ4FM471QzBIcFDkOihzFLIHzHqdV3+0YEfbnGZSxl67lTRIo7ZxbM8b2Mck9AJRthyJLsSj6i8Y6h6qVwbNL3gxGFsUcyliUbRcmnikZvfftVQDee78EsA8AWRJPlXHetMhigWKW4n4+g9QGytjQqBgxxDwKN1/dSbRXPJ+nF2c6516NEefDwiulXmZZ9i4AFFmCRioc7l+QZhTBoz8trWKWopill57Nk0sz4W+j3TEC7vT09Mssyz7GUOsEoGwlaimhtA1D6UjGTcKIcLCXh6FU8AizJEaeJrg3AVRV1dcA3HQvAYibpnl612N513U/P3jwIN70UcSePHmyKMvyuzs0/suzZ8/e3tYAafj8yl68ePHRycnJt13X/W6MKW9r0DkntdbHZVn+dHR09Pjhw4ezwfj1D5PJfxrIKYY5kV/ddEPxQ54NAAVAD2t/qeds2TwCYZP1bcRPgPhNX8p/AEIA9v67Ae68AAAAAElFTkSuQmCC'
      }

      return {
        name: info.CFBundleName,
        path: fullAppPath,
        icon
      }
    } else {
      return null // Skip non-app directories
    }
  })

  const apps = await Promise.all(appPromises)
  return apps.filter(Boolean) // Remove null results
}
