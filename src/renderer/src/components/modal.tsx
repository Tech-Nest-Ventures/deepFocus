const Modal = (props) => {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div class="bg-black border-2 border-foreground p-swiss-8 w-96 max-w-full">
        <div class="flex justify-between items-center mb-swiss-6">
          {props.title && <h2 class="text-xl font-extrabold uppercase tracking-tight">{props.title}</h2>}
          <button class="text-foreground hover:opacity-70 font-bold text-2xl transition-opacity duration-200" onClick={props.onClose}>
            ✖
          </button>
        </div>
        <div>{props.children}</div>
      </div>
    </div>
  )
}

export default Modal
