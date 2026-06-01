import { useTakeoffStore } from '../store/takeoffStore';

export default function PageThumbnails() {
  const { project, currentPageIndex, setCurrentPage } = useTakeoffStore();

  if (!project) return null;

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="text-xs text-zinc-500 px-1 font-medium">
        {project.pages.length} page{project.pages.length !== 1 ? 's' : ''}
      </div>
      {project.pages.map((page) => (
        <button
          key={page.pageIndex}
          className={`flex flex-col items-center gap-1 p-1 rounded-lg border-2 transition-colors ${
            page.pageIndex === currentPageIndex
              ? 'border-blue-500 bg-blue-50'
              : 'border-transparent hover:border-zinc-300'
          }`}
          onClick={() => setCurrentPage(page.pageIndex)}
        >
          <img
            src={page.imageDataUrl}
            alt={`Page ${page.pageIndex + 1}`}
            className="w-20 object-contain rounded"
            style={{
              filter:
                page.colorMode === 'grayscale'
                  ? 'grayscale(1)'
                  : page.colorMode === 'bw'
                  ? 'grayscale(1) contrast(1.8) brightness(1.1)'
                  : page.colorMode === 'half'
                  ? 'grayscale(0.5)'
                  : 'none',
            }}
          />
          <span className="text-xs text-zinc-500">{page.pageIndex + 1}</span>
        </button>
      ))}
    </div>
  );
}
