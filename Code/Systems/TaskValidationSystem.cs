using Game;

namespace Planboard.Systems
{
    public partial class TaskValidationSystem : GameSystemBase
    {
        private TaskDataSystem _data;

        protected override void OnCreate()
        {
            base.OnCreate();
            _data = World.GetOrCreateSystemManaged<TaskDataSystem>();
        }

        protected override void OnUpdate()
        {
            if (_data.PendingValidation) _data.ValidateLoadedData(EntityManager);
        }
    }
}
