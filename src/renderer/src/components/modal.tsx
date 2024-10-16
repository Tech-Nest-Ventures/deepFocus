const Modal = (props) => {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-black p-6 rounded-lg shadow-lg w-96">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-normal">{props.title}</h2>
          <button class="text-gray-500 hover:text-gray-800" onClick={props.onClose}>
            ✖
          </button>
        </div>
        <div class="mt-4">{props.children}</div>
      </div>
    </div>
  )
}

export default Modal
