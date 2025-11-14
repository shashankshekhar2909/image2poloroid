'use client'

import { useState, useRef } from 'react'

interface PolaroidData {
  imageUrl: string
}

export default function Home() {
  const [polaroids, setPolaroids] = useState<PolaroidData[][]>([])
  const [hasImages, setHasImages] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pagesRef = useRef<(HTMLDivElement | null)[]>([])

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    if (!files.length) {
      setHasImages(false)
      setPolaroids([])
      return
    }

    setIsLoading(true)
    setLoadingProgress({ current: 0, total: files.length })
    setHasImages(false)
    setPolaroids([])

    const perPage = 15 // 3 columns x 5 rows for A4
    const pages: PolaroidData[][] = []
    let currentPage: PolaroidData[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      setLoadingProgress({ current: i + 1, total: files.length })
      
      if (currentPage.length === 0) {
        currentPage = []
      }

      const imageUrl = await loadImage(file)
      
      if (imageUrl) {
        currentPage.push({ imageUrl })
      }

      if (currentPage.length === perPage) {
        pages.push(currentPage)
        currentPage = []
      }
    }

    if (currentPage.length > 0) {
      pages.push(currentPage)
    }

    console.log('Pages created:', pages.length, 'Total images:', pages.reduce((sum, p) => sum + p.length, 0))
    setPolaroids(pages)
    setHasImages(pages.length > 0)
    setIsLoading(false)
    setLoadingProgress({ current: 0, total: 0 })
  }

  const loadImage = async (file: File): Promise<string | null> => {
    const isHeic = /\.heic$|\.heif$/i.test(file.name || '')
    let blob: Blob = file

    if (isHeic) {
      try {
        const heic2anyModule = await import('heic2any')
        const heic2any = heic2anyModule.default || heic2anyModule
        const converted = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9,
        })
        blob = Array.isArray(converted) ? converted[0] : converted
      } catch (e) {
        console.warn('HEIC convert failed:', e)
        return null
      }
    }

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        console.log('Image loaded:', file.name, result ? 'success' : 'failed')
        resolve(result)
      }
      reader.onerror = (e) => {
        console.error('Error reading file:', file.name, e)
        resolve(null)
      }
      reader.readAsDataURL(blob)
    })
  }

  const handlePrint = () => {
    if (polaroids.length === 0) {
      alert('No images to print. Please upload images first.')
      return
    }
    window.print()
  }

  const generateImages = async () => {
    if (polaroids.length === 0) {
      alert('No images to generate. Please upload images first.')
      return
    }

    console.log('Starting PDF generation, pages:', polaroids.length)
    
    setIsGenerating(true)
    setLoadingProgress({ current: 0, total: polaroids.length })
    
    try {
      // Dynamically import jsPDF and html2canvas
      const [{ default: jsPDF }, html2canvasModule] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ])
      const html2canvas = html2canvasModule.default || html2canvasModule
      
      if (!html2canvas || !jsPDF) {
        throw new Error('Libraries not loaded')
      }

      console.log('Libraries loaded successfully')

      // Create a new PDF document
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      for (let i = 0; i < polaroids.length; i++) {
        setLoadingProgress({ current: i + 1, total: polaroids.length })
        const pageElement = pagesRef.current[i]
        console.log(`Processing page ${i + 1}, element:`, pageElement)
        
        if (!pageElement) {
          console.warn(`Page element ${i} not found`)
          continue
        }

        // Wait for all images in the page to load
        const images = pageElement.querySelectorAll('img')
        const imagePromises = Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve, reject) => {
            img.onload = () => resolve(undefined)
            img.onerror = () => reject(new Error('Image failed to load'))
            setTimeout(() => reject(new Error('Image load timeout')), 5000)
          })
        })
        
        try {
          await Promise.all(imagePromises)
          console.log(`All images loaded for page ${i + 1}`)
        } catch (e) {
          console.warn(`Some images failed to load for page ${i + 1}:`, e)
        }

        // Wait for rendering
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Get element dimensions
        const rect = pageElement.getBoundingClientRect()
        const scale = 2 // Good quality for PDF
        
        console.log(`Generating canvas for page ${i + 1}...`)
        
        const canvas = await html2canvas(pageElement, {
          scale: scale,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: false,
          removeContainer: false,
          imageTimeout: 20000,
          onclone: (clonedDoc) => {
            const clonedElement = clonedDoc.querySelector('.page') as HTMLElement
            if (clonedElement) {
              clonedElement.style.backgroundColor = '#ffffff'
            }
          },
        })

        // Convert canvas to image data
        const imgData = canvas.toDataURL('image/png', 1.0)
        
        // A4 dimensions in mm (210mm x 297mm)
        const a4Width = 210
        const a4Height = 297
        
        // The page element is already A4 size, so we can use A4 dimensions directly
        // Account for the scale factor when converting canvas pixels to mm
        // At scale 2, canvas is 2x the element size in pixels
        const elementWidthMm = a4Width
        const elementHeightMm = a4Height
        
        // Add new page if not first page
        if (i > 0) {
          pdf.addPage()
        }
        
        // Add image to PDF, filling the entire A4 page
        pdf.addImage(imgData, 'PNG', 0, 0, elementWidthMm, elementHeightMm, undefined, 'FAST')
        
        console.log(`Page ${i + 1} added to PDF`)
      }
      
      // Save the PDF
      pdf.save('polaroid-a4-sheets.pdf')
      console.log('PDF saved successfully')
      
      alert(`Successfully generated PDF with ${polaroids.length} A4 page(s)!`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert(`Error generating PDF: ${error instanceof Error ? error.message : 'Unknown error'}. Check console for details.`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="controls max-w-4xl mx-auto mb-4 p-3 bg-white rounded-lg shadow-sm flex flex-wrap items-center gap-3 justify-between">
        <div className="max-w-[65%]">
          <h1 className="text-lg font-semibold mb-1 m-0">Bulk Polaroid A4 Generator</h1>
          <div className="text-xs text-gray-600">
            Upload multiple images to create Polaroid-style A4 sheets. Images rotated 90° for printing.
          </div>
          <div className="text-[11px] text-orange-700 mt-1">
            HEIC images are converted to JPEG automatically.
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="fileInput" className="cursor-pointer">
            <input
              id="fileInput"
              ref={fileInputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              onChange={handleFiles}
              className="hidden"
            />
            <span className="inline-block px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 cursor-pointer">
              Upload Images
            </span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              disabled={!hasImages}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Print A4 Pages
            </button>
            <button
              onClick={generateImages}
              disabled={isGenerating || !hasImages}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : 'Generate A4 PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {(isLoading || isGenerating) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 shadow-xl">
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {isLoading ? 'Processing Images...' : 'Generating A4 PDF...'}
              </h3>
              {isLoading && loadingProgress.total > 0 && (
                <div className="w-full">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Processing images</span>
                    <span>{loadingProgress.current} / {loadingProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(loadingProgress.current / loadingProgress.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}
              {isGenerating && loadingProgress.total > 0 && (
                <div className="w-full mt-2">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Generating pages</span>
                    <span>{loadingProgress.current} / {loadingProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(loadingProgress.current / loadingProgress.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Creating high-quality A4 PDF for printing...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[210mm] mx-auto mb-6">
        {!hasImages && !isLoading && (
          <p className="text-center text-gray-500 py-8">
            No images loaded yet. Use the &quot;Upload Images&quot; button above.
          </p>
        )}

        {polaroids.length > 0 && (
          <div className="no-print text-center text-sm text-gray-600 mb-2">
            {polaroids.length} page(s) with {polaroids.reduce((sum, p) => sum + p.length, 0)} image(s) total
          </div>
        )}

        {polaroids.map((page, pageIndex) => (
          <div
            key={pageIndex}
            ref={(el) => {
              pagesRef.current[pageIndex] = el
            }}
            className="page w-[210mm] h-[297mm] my-4 mx-auto shadow-lg p-[3mm]"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gridAutoRows: '1fr',
              gap: '2mm',
              backgroundColor: '#ffffff',
              background: '#ffffff',
            }}
          >
            {page.map((polaroid, index) => (
              <div
                key={index}
                className="flex flex-col bg-white rounded-sm overflow-hidden"
                style={{
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  padding: '2mm',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  width: '100%',
                }}
              >
                <div 
                  className="flex-1 w-full overflow-hidden flex items-center justify-center"
                  style={{
                    minHeight: 0,
                    width: '100%',
                  }}
                >
                  <img
                    src={polaroid.imageUrl}
                    alt={`Image ${index + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      transform: 'rotate(90deg)',
                      transformOrigin: 'center center',
                      display: 'block',
                      objectFit: 'cover',
                      objectPosition: 'center',
                      imageRendering: 'auto',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                    crossOrigin="anonymous"
                    onLoad={(e) => {
                      // Ensure image maintains aspect ratio
                      const img = e.target as HTMLImageElement
                      if (img.naturalWidth && img.naturalHeight) {
                        // Preserve natural aspect ratio
                        img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

