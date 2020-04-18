# TODO

List of some major tasks to do.

## A. API Changes

### Multiple Roles during assigning roles
  
  **currently** you can do as following:

  ```acl.assignRoles(user, ['superadmin','admin'])```

  ```acl.assignRoles(user, 'superadmin')```

  **desired** : pass multiple roles

  ```js
    acl.assignRoles([user, user2], ['superadmin','admin'])
  ```

  ```js
    acl.assignRoles([
      {
        user : user,
        role : 'superadmin'
      },{
        user : user2,
        role : 'admin'
      }
    ])
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

  ```BlogPost.can('have comments').```
