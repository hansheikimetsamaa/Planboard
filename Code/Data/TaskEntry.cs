using System.Collections.Generic;
using System.Linq;
using Unity.Entities;
using Unity.Mathematics;

// Defines the task record and data-issue shapes persisted with each city.

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
        // V3 stores every physical pin here. The original fields above are kept as a
        // synchronized first-location view so older UI bindings and saved V1/V2 data remain safe.
        public List<TaskLocation> Locations = new();
        public int NextLocationId = 1;

        public bool HasLocation => Locations.Count > 0;
        public TaskLocation PrimaryLocation => Locations.Count > 0 ? Locations[0] : null;
        public bool HasRealDueDate => RealDueDateTicks > 0;
        public bool HasGameDueDate => GameDueDateTicks > 0;

        public TaskEntry Clone()
        {
            TaskEntry clone = (TaskEntry)MemberwiseClone();
            clone.Locations = Locations.Select(location => location.Clone()).ToList();
            return clone;
        }

        public void SyncLegacyLocation()
        {
            TaskLocation location = PrimaryLocation;
            if (location == null)
            {
                SpatialKind = SpatialKind.None;
                Position = default;
                LinkedEntity = Entity.Null;
                LinkedDistrict = Entity.Null;
                MarkerMoved = false;
                LinkState = LinkState.Unlinked;
                return;
            }

            SpatialKind = location.SpatialKind;
            Position = location.Position;
            LinkedEntity = location.LinkedEntity;
            LinkedDistrict = location.LinkedDistrict;
            MarkerMoved = location.MarkerMoved;
            LinkState = location.LinkState;
        }
    }

    public sealed class TaskLocation
    {
        public int Id;
        public SpatialKind SpatialKind = SpatialKind.Point;
        public float3 Position;
        public Entity LinkedEntity = Entity.Null;
        public Entity LinkedDistrict = Entity.Null;
        public bool MarkerMoved;
        public LinkState LinkState = LinkState.Unlinked;

        public bool HasLocation => SpatialKind == SpatialKind.Point;

        public TaskLocation Clone()
        {
            return (TaskLocation)MemberwiseClone();
        }
    }

    public struct RuntimeTaskMarker : IComponentData
    {
        public int EntryId;
        public int LocationId;
        public EntryCategory Category;
        public EntryKind Kind;
        public EntryPriority Priority;
        public EntryStatus Status;
        public bool RealOverdue;
        public bool GameOverdue;
        // District anchors are a runtime presentation detail. Persisted entries keep their
        // fallback coordinates and district link, while markers resolve the live centre.
        public bool IsDistrict;
        // Several entries can share this one district anchor. The renderer uses the link
        // only to deduplicate world outlines; it is never serialized as marker state.
        public Entity LinkedDistrict;
    }
}
