import "@testing-library/jest-dom"

// jsdom does not implement scrollIntoView — stub it globally
window.HTMLElement.prototype.scrollIntoView = () => {}

// jsdom does not implement Blob.text() / File.text() — polyfill via FileReader
if (!Blob.prototype.text) {
  Blob.prototype.text = function (): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this as Blob)
    })
  }
}
