interface AlertModalProps {
  title?: string;
  message: string;
  onOk: () => void;
}

export default function AlertModal({
  title = "Notification",
  message,
  onOk,
}: AlertModalProps): JSX.Element {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onOk}
    >
      <div
        className="bg-gray-800 p-6 rounded-lg w-96 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4 text-white">
          {title}
        </h2>

        <p className="text-gray-300 mb-6">
          {message}
        </p>

        <div className="flex justify-end">
          <button
            onClick={onOk}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
