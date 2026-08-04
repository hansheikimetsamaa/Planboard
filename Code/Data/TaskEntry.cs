using Unity.Entities;
using Unity.Mathematics;

namespace Planboard.Data
{
    public enum DataIssueSeverity : byte { Warning, Error }

    public sealed class TaskDataIssue
    {
        public DataIssueSeverity Severity;
        public int EntryId;
        public string Message = string.Empty;
    }

    public sealed class TaskEntry
    {
        public int Id;
        public string Title = string.Empty;
        public string Description = string.Empty;
        public EntryKind Kind = EntryKind.Task;
        public EntryCategory Category = EntryCategory.General;
        public string CustomCategory = string.Empty;
        public EntryStatus Status = EntryStatus.Open;
        public EntryPriority Priority = EntryPriority.None;
        public long CreatedUtcTicks;
        public long UpdatedUtcTicks;
        public long RealDueDateTicks;
        public long GameDueDateTicks;
        public SpatialKind SpatialKind = SpatialKind.None;
        public float3 Position;
        public Entity LinkedEntity = Entity.Null;
        public Entity LinkedDistrict = Entity.Null;
        public bool MarkerMoved;
        public LinkState LinkState = LinkState.Unlinked;

        public bool HasLocation => SpatialKind == SpatialKind.Point;
        public bool HasRealDueDate => RealDueDateTicks > 0;
        public bool HasGameDueDate => GameDueDateTicks > 0;

        public TaskEntry Clone()
        {
            return (TaskEntry)MemberwiseClone();
        }
    }

    public struct RuntimeTaskMarker : IComponentData
    {
        public int EntryId;
        public EntryCategory Category;
        public EntryKind Kind;
        public EntryPriority Priority;
        public EntryStatus Status;
        public bool RealOverdue;
        public bool GameOverdue;
    }
}
