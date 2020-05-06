# TODO

List of some major tasks to do.

## A. API Changes

### Multiple Roles during assigning roles

**currently** you can do as following:

`guard.assignRoles(user, ['superadmin','admin'])`

`guard.assignRoles(user, 'superadmin')`

**desired** : pass multiple roles

```js
guard.assignRoles([user, user2], ['superadmin', 'admin']);
```

```js
guard.assignRoles([
  {
    user: user,
    role: 'superadmin',
  },
  {
    user: user2,
    role: 'admin',
  },
]);
```

### Create Child Roles

Write API to create child roles. Database and models are already setup to have this.

Just create easy api to support that.

## D. Database/ Structural Changes

### D.1 Make Role & Permission Model Polymorphic

- Polymorphic relationship with role dso than, Any model can have roles.
- If possible (not sure) make permission polymorphic too.

  e.g. If we give role "commentable" to Post, and "Commentable" role has permission to "have comments"
  then we can check.

  `BlogPost.can('have comments').`

====================================
1
[
{
id: 7,
name: 'superadmin',
description: null,
parent_id: null,
RoleUser: { id: 4, role_id: 7, user_id: 1 }
}
]
====================================
✓ should allow superadmin to _
====================================
2
[
{
id: 4,
name: 'user',
description: 'A basic user',
parent_id: null,
RoleUser: { id: 5, role_id: 4, user_id: 2 }
},
{
id: 6,
name: 'admin',
description: null,
parent_id: null,
RoleUser: { id: 6, role_id: 6, user_id: 2 }
}
]
====================================
✓ should not allow admin to _
====================================
4
[
{
id: 4,
name: 'user',
description: 'A basic user',
parent_id: null,
RoleUser: { id: 9, role_id: 4, user_id: 4 }
}
]
====================================
